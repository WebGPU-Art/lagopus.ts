import { LagopusAttribute, LagopusElement, LagopusHitRegion, LagopusObjectData } from "./primes.mjs";
import {
  atomDepthTexture,
  atomContext,
  atomDevice,
  atomBufferNeedClear,
  atomLagopusTree,
  atomProxiedDispatch,
  atomObjectsTree,
  atomClearColor,
  wLog,
  atomCanvasTexture,
  atomCommandEncoder,
  atomPingBuffer,
  atomPongBuffer,
  atomFilterTexture,
  atomPingTexture,
  atomPongTexture,
  atomBloomEnabled,
} from "./global.mjs";
import { coneBackScale } from "./config.mjs";
import { atomViewerPosition, atomViewerScale, atomViewerUpward, newLookatPoint } from "./perspective.mjs";
import { vNormalize, vCross, vLength } from "@triadica/touch-control";
import fullscreenWgsl from "../shaders/fullscreen.wgsl";
import blurWGSL from "../shaders/blur.wgsl";
import screenFilterWgsl from "../shaders/screen-filter.wgsl";
import { clearCanvas } from "./clear";

/** prepare vertex buffer from object */
export let createRenderer = (
  shaderCode: string,
  topology: GPUPrimitiveTopology,
  attrsList: LagopusAttribute[],
  verticesLength: number,
  vertices: (Float32Array | Uint32Array)[],
  hitRegion: LagopusHitRegion,
  indices: Uint32Array,
  getParams: () => number[],
  textures: GPUTexture[],
  label: string
): LagopusObjectData => {
  // load shared device
  let device = atomDevice.deref();

  let vertexBuffers = vertices.map((v) => createBuffer(v, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST));
  let indicesBuffer = indices ? createBuffer(indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST) : null;

  const vertexBuffersDescriptors = attrsList.map((info, idx) => {
    let stride = readFormatSize(info.format);
    return {
      attributes: [
        {
          shaderLocation: idx,
          offset: 0,
          format: info.format,
        },
      ],
      arrayStride: stride,
      stepMode: "vertex" as GPUVertexStepMode,
    } as GPUVertexBufferLayout;
  });

  // ~~ DEFINE BASIC SHADERS ~~
  const shaderModule = device.createShaderModule({
    label,
    code: shaderCode,
  });

  shaderModule.getCompilationInfo().then((e) => {
    // a dirty hook to expose build messages
    globalThis.__lagopusHandleCompilationInfo?.(e, shaderCode);
  });

  return {
    type: "object",
    topology: topology,
    shaderModule: shaderModule,
    vertexBuffersDescriptors: vertexBuffersDescriptors,
    vertexBuffers,
    length: verticesLength,
    hitRegion: hitRegion,
    indices: indicesBuffer,
    getParams,
    textures,
    label,
  };
};

let buildCommandBuffer = (info: LagopusObjectData): void => {
  let { topology, shaderModule, vertexBuffersDescriptors, vertexBuffers, indices } = info;

  let device = atomDevice.deref();
  let context = atomContext.deref();
  let depthTexture = atomDepthTexture.deref();

  // create uniforms
  // based on code from https://alain.xyz/blog/raw-webgpu

  let lookAt = newLookatPoint();
  let forward = vNormalize(lookAt);
  let rightward = vCross(forward, atomViewerUpward.deref());
  // 👔 Uniform Data
  const uniformData = new Float32Array([
    // coneBackScale
    coneBackScale,
    // viewport_ratio
    window.innerHeight / window.innerWidth,
    vLength(lookAt),
    // alignment
    atomViewerScale.deref(),
    // lookpoint
    ...forward,
    // alignment
    0,
    // upwardDirection
    ...atomViewerUpward.deref(),
    // alignment
    0,
    ...rightward,
    // alignment
    0,
    // cameraPosition
    ...atomViewerPosition.deref(),
    // alignment
    0,
  ]);

  const customParams = new Float32Array([...(info.getParams?.() || [0])]);

  let uniformBuffer = createBuffer(uniformData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  let customParamsBuffer = createBuffer(customParams, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  // console.log(info.getParams?.(), uniformData.length, uniformBuffer);

  let uniformBindGroupLayout = device.createBindGroupLayout({
    label: info.label,
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });

  let uniformBindGroup: GPUBindGroup = device.createBindGroup({
    label: info.label,
    layout: uniformBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: customParamsBuffer } },
    ],
  });

  let textureLayouts: GPUBindGroupLayout[] = [];
  let textureBindGroup: GPUBindGroup = undefined;

  if (info.textures && info.textures[0]) {
    let entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        type: "comparison-sampler",
      } as GPUBindGroupLayoutEntry,
    ].concat(
      info.textures.map((texture, idx) => {
        return {
          binding: idx + 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float", viewDimension: "2d", multisampled: false },
        };
      })
    );
    let layout = device.createBindGroupLayout({ label: info.label, entries });
    textureLayouts.push(layout);

    debugger;

    const sampler = device.createSampler({
      label: info.label,
      magFilter: "linear",
      minFilter: "linear",
    });

    textureBindGroup = device.createBindGroup({
      label: info.label,
      layout,
      entries: [
        {
          binding: 0,
          resource: sampler,
        } as GPUBindGroupEntry,
      ].concat(
        info.textures.map((texture, idx) => {
          return {
            binding: idx + 1,
            resource: texture.createView(),
          };
        })
      ),
    });
  }

  let renderLayout = device.createPipelineLayout({
    label: info.label,
    bindGroupLayouts: [uniformBindGroupLayout, ...textureLayouts],
  });

  // ~~ CREATE RENDER PIPELINE ~~
  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();
  const pipeline = device.createRenderPipeline({
    label: info.label,
    layout: renderLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: vertexBuffersDescriptors,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: presentationFormat,
          // TODO need to learn more details
          // https://github.com/takahirox/webgpu-trial/blob/master/cube_alpha_blend.html#L273
          // https://github.com/kdashg/webgpu-js/blob/master/hello-blend.html#L98
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: {
      topology,
      // pick uint32 for general usages
      stripIndexFormat: topology === "line-strip" || topology === "triangle-strip" ? "uint32" : undefined,
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus-stencil8",
    },
    // multisample: atomBloomEnabled.deref() ? undefined : { count: 4 },
  });

  let needClear = atomBufferNeedClear.deref();

  // ~~ CREATE RENDER PASS DESCRIPTOR ~~
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        clearValue: atomClearColor.deref() ?? { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: (needClear ? "clear" : "load") as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        view: atomBloomEnabled.deref() ? atomCanvasTexture.deref().createView() : context.getCurrentTexture().createView(),
        // resolveTarget: atomBloomEnabled.deref() ? undefined : context.getCurrentTexture().createView(),
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1,
      depthLoadOp: (needClear ? "clear" : "load") as GPULoadOp,
      depthStoreOp: "store" as GPUStoreOp,
      stencilLoadOp: "clear" as GPULoadOp,
      stencilStoreOp: "store" as GPUStoreOp,
    },
  };

  atomBufferNeedClear.reset(false);

  const commandEncoder = atomCommandEncoder.deref();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setBindGroup(0, uniformBindGroup);
  if (textureBindGroup) {
    debugger;
    // occupies 1 for texture
    passEncoder.setBindGroup(1, textureBindGroup);
  }

  passEncoder.setPipeline(pipeline);
  // let w = window.innerWidth * devicePixelRatio;
  // let h = window.innerHeight * devicePixelRatio;
  // this.passEncoder.setViewport(0, 0, w, h, 0, 1);
  // this.passEncoder.setScissorRect(0, 0, w, h);
  vertexBuffers.forEach((vertexBuffer, idx) => {
    passEncoder.setVertexBuffer(idx, vertexBuffer);
  });

  if (indices) {
    // just use uint32, skip uint16
    passEncoder.setIndexBuffer(indices, "uint32");
    passEncoder.drawIndexed(indices.size / 4);
  } else {
    passEncoder.draw(info.length);
  }
  passEncoder.end();
};

export let collectBuffers = (el: LagopusElement) => {
  if (el == null) return;
  if (el.type === "object") {
    buildCommandBuffer(el);
  } else {
    el.children.forEach((child) => collectBuffers(child));
  }
};

// 👋 Helper function for creating GPUBuffer(s) out of Typed Arrays
const createBuffer = (arr: Float32Array | Uint32Array, usage: number) => {
  // 📏 Align to 4 bytes (thanks @chrimsonite)
  let desc = {
    size: (arr.byteLength + 3) & ~3,
    // size: 64,
    usage,
    mappedAtCreation: true,
  };
  let device = atomDevice.deref();
  let buffer = device.createBuffer(desc);

  const writeArray = arr instanceof Uint32Array ? new Uint32Array(buffer.getMappedRange()) : new Float32Array(buffer.getMappedRange());
  writeArray.set(arr);
  buffer.unmap();
  return buffer;
};

/** send command buffer to device and render */
export function paintLagopusTree() {
  let device = atomDevice.deref();
  atomCommandEncoder.reset(device.createCommandEncoder());

  atomBufferNeedClear.reset(true);
  let tree = atomLagopusTree.deref();
  collectBuffers(tree);

  if (atomBufferNeedClear.deref()) {
    clearCanvas();
  } else if (atomBloomEnabled.deref()) {
    postRendering();
  }
  // load shared device
  let commandEncoder = atomCommandEncoder.deref();
  device.queue.submit([commandEncoder.finish()]);
}

export function postRendering() {
  let canvasTexture = atomCanvasTexture.deref();
  let device = atomDevice.deref();
  let context = atomContext.deref();
  let width = window.innerWidth * devicePixelRatio;
  let height = window.innerHeight * devicePixelRatio;

  let sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  const commandEncoder = atomCommandEncoder.deref();

  let pingTexture = atomPingTexture.deref();
  let pongTexture = atomPongTexture.deref();

  const filterTexture = atomFilterTexture.deref();

  // previously rendered to canvasTexture. filter bright colors

  const screenQuadFilterPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: screenFilterWgsl,
      }),
      entryPoint: "vert_main",
    },
    fragment: {
      module: device.createShaderModule({
        code: screenFilterWgsl,
      }),
      entryPoint: "frag_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
    // multisample: atomBloomEnabled.deref() ? undefined : { count: 4 },
  });

  const filterResultBindGroup = device.createBindGroup({
    layout: screenQuadFilterPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: canvasTexture.createView() },
    ],
  });

  const filterPassEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: filterTexture.createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  filterPassEncoder.setPipeline(screenQuadFilterPipeline);
  filterPassEncoder.setBindGroup(0, filterResultBindGroup);
  filterPassEncoder.draw(6, 1, 0, 0);
  filterPassEncoder.end();

  // doing post-process of blur

  const blurPipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: blurWGSL,
      }),
      entryPoint: "main",
    },
  });

  let iterations = 1;

  let buffer0 = atomPingBuffer.deref();
  let buffer1 = atomPongBuffer.deref();
  const blurParamsBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });

  device.queue.writeBuffer(blurParamsBuffer, 0, new Uint32Array([40, 20]));

  const computeConstants = device.createBindGroup({
    layout: blurPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: {
          buffer: blurParamsBuffer,
        },
      },
    ],
  });

  const computeBindGroup0 = device.createBindGroup({
    layout: blurPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 1, resource: filterTexture.createView() },
      { binding: 2, resource: pingTexture.createView() },
      { binding: 3, resource: { buffer: buffer0 } },
    ],
  });

  const computeBindGroup1 = device.createBindGroup({
    layout: blurPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 1, resource: pingTexture.createView() },
      { binding: 2, resource: pongTexture.createView() },
      { binding: 3, resource: { buffer: buffer1 } },
    ],
  });

  const computeBindGroup2 = device.createBindGroup({
    layout: blurPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 1, resource: pongTexture.createView() },
      { binding: 2, resource: pingTexture.createView() },
      { binding: 3, resource: { buffer: buffer0 } },
    ],
  });

  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(blurPipeline);
  computePass.setBindGroup(0, computeConstants);

  computePass.setBindGroup(1, computeBindGroup0);
  // computePass.dispatchWorkgroups(Math.ceil(height / 2), Math.ceil(width / 2), 4);
  computePass.dispatchWorkgroups(width / 2, height / 4);

  computePass.setBindGroup(1, computeBindGroup1);
  // computePass.dispatchWorkgroups(Math.ceil(height), Math.ceil(width / batched));
  computePass.dispatchWorkgroups(width / 2, height / 4);

  for (let i = 0; i < iterations - 1; ++i) {
    computePass.setBindGroup(1, computeBindGroup2);
    // computePass.dispatchWorkgroups(Math.ceil(width), Math.ceil(height / batched));
    computePass.dispatchWorkgroups(width / 2, height / 4);

    computePass.setBindGroup(1, computeBindGroup1);
    // computePass.dispatchWorkgroups(Math.ceil(height), Math.ceil(width / batched));
    computePass.dispatchWorkgroups(width / 2, height / 4);
  }

  computePass.end();

  // now we need to render it to real canvas

  const fullscreenQuadPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: fullscreenWgsl,
      }),
      entryPoint: "vert_main",
    },
    fragment: {
      module: device.createShaderModule({
        code: fullscreenWgsl,
      }),
      entryPoint: "frag_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  const showResultBindGroup = device.createBindGroup({
    layout: fullscreenQuadPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: pingTexture.createView() },
      { binding: 2, resource: canvasTexture.createView() },
    ],
  });

  const showPassEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  showPassEncoder.setPipeline(fullscreenQuadPipeline);
  showPassEncoder.setBindGroup(0, showResultBindGroup);
  showPassEncoder.draw(6, 1, 0, 0);
  showPassEncoder.end();
}

/** track tree, internally it calls `paintLagopusTree` to render */
export function renderLagopusTree(tree: LagopusElement, dispatch: (op: any, data: any) => void) {
  atomLagopusTree.reset(tree);
  atomProxiedDispatch.reset(dispatch);
  atomObjectsTree.reset(tree);
  paintLagopusTree();
}

export function resetCanvasSize(canvas: HTMLCanvasElement) {
  // canvas height not accurate on Android Pad, use innerHeight
  canvas.style.height = `${window.innerHeight}px`;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.width = window.innerWidth * devicePixelRatio;
}

/** some size from https://www.w3.org/TR/webgpu/#vertex-formats */
export function readFormatSize(format: GPUVertexFormat): number {
  switch (format) {
    case "float32":
      return 4;
    case "float32x2":
      return 8;
    case "float32x3":
      return 12;
    case "float32x4":
      return 16;
    case "uint32":
      return 4;
    case "uint32x2":
      return 8;
    case "uint32x3":
      return 12;
    case "uint32x4":
      return 16;
    default:
      throw new Error(`Unimplemented format size for: ${format}`);
  }
}

export let createTextureFromSource = (device: GPUDevice, source: { w: number; h: number; source: GPUImageCopyExternalImageSource }) => {
  let texture = device.createTexture({
    size: { width: source.w, height: source.h },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(source, { texture }, { width: source.w, height: source.h });
  return texture;
};
