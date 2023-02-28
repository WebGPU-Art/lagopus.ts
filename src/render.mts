import { LagopusElement, LagopusObjectData } from "./primes.mjs";
import { atomDepthTexture, atomContext, atomDevice, atomBufferNeedClear } from "./global.mjs";
import { coneBackScale } from "./config.mjs";
import { atomViewerPosition, atomViewerUpward, newLookatPoint } from "./perspective.mjs";
import { vNormalize, vCross, vLength } from "./quaternion.mjs";

export const initializeContext = async (): Promise<any> => {
  // ~~ INITIALIZE ~~ Make sure we can initialize WebGPU
  if (!navigator.gpu) {
    console.error("WebGPU cannot be initialized - navigator.gpu not found");
    return null;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("WebGPU cannot be initialized - Adapter not found");
    return null;
  }
  const device = await adapter.requestDevice();
  device.lost.then(() => {
    console.error("WebGPU cannot be initialized - Device has been lost");
    return null;
  });

  // set as a shared device
  atomDevice.reset(device);

  const canvas = document.getElementById("canvas-container") as HTMLCanvasElement;
  const context = canvas.getContext("webgpu");
  if (!context) {
    console.error("WebGPU cannot be initialized - Canvas does not support WebGPU");
    return null;
  }

  // ~~ CONFIGURE THE SWAP CHAIN ~~
  const devicePixelRatio = window.devicePixelRatio || 1;
  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();

  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;

  context.configure({
    device,
    format: presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    alphaMode: "premultiplied",
  });

  // set as a shared context
  atomContext.reset(context);

  const depthTexture = device.createTexture({
    size: [window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio],
    // format: "depth24plus",
    // usage: GPUTextureUsage.RENDER_ATTACHMENT,
    dimension: "2d",
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  atomDepthTexture.reset(depthTexture);
};

export let createRenderer = (
  shaderCode: string,
  topology: GPUPrimitiveTopology,
  attrsList: {
    field: string;
    format: GPUVertexFormat;
    size: number;
    /** defaults to 4 for `float32` since 32=8*4, would change for other types */
    unitSize?: number;
  }[],
  verticesLength: number,
  vertices: Float32Array
): LagopusObjectData => {
  // load shared device
  let device = atomDevice.deref();

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

  // need to decide `location` based on given information
  let offsetCollect = 0;
  // expected attributes descriptor
  // [
  //   { shaderLocation: 0, offset: 0, format: "float32x4" as GPUVertexFormat },
  //   { shaderLocation: 1, offset: 16, format: "float32x4" as GPUVertexFormat },
  // ];

  const vertexBuffersDescriptors = [
    {
      attributes: attrsList.map((info, idx) => {
        let { format, size } = info;
        let offset = offsetCollect;
        offsetCollect += size * (info.unitSize || 4);
        return { shaderLocation: idx, offset, format };
      }),
      arrayStride: 32,
      stepMode: "vertex" as GPUVertexStepMode,
    },
  ];

  // ~~ DEFINE BASIC SHADERS ~~
  const shaderModule = device.createShaderModule({
    code: shaderCode,
  });

  shaderModule.compilationInfo().then((e) => {
    // a dirty hook to expose build messages
    globalThis.__lagopusHandleCompilationInfo?.(e, shaderCode);
  });

  return {
    type: "object",
    topology: topology,
    shaderModule: shaderModule,
    vertexBuffersDescriptors: vertexBuffersDescriptors,
    vertexBuffer: vertexBuffer,
    length: verticesLength,
  };
};

let buildCommandBuffer = (info: LagopusObjectData): GPUCommandBuffer => {
  let { topology, shaderModule, vertexBuffersDescriptors, vertexBuffer } = info;

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
    // viewportRatio
    window.innerHeight / window.innerWidth,
    vLength(lookAt),
    // alignment
    0,
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

  let uniformBuffer: GPUBuffer = null;

  uniformBuffer = createBuffer(uniformData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

  let uniformBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {}, // TODO don't know why, but fixes, https://programmer.ink/think/several-best-practices-of-webgpu.html
      },
    ],
  });

  let uniformBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
  let renderLayout = device.createPipelineLayout(pipelineLayoutDesc);

  // ~~ CREATE RENDER PIPELINE ~~
  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();
  const pipeline = device.createRenderPipeline({
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
        },
      ],
    },
    primitive: {
      topology,
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus-stencil8",
    },
  });

  let needClear = atomBufferNeedClear.deref();

  // ~~ CREATE RENDER PASS DESCRIPTOR ~~
  const renderPassDescriptor = {
    colorAttachments: [
      {
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: (needClear ? "clear" : "load") as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        view: null as GPUTextureView,
      },
    ],
    depthStencilAttachment: {
      view: null as GPUTextureView,
      depthClearValue: 1,
      depthLoadOp: (needClear ? "clear" : "load") as GPULoadOp,
      depthStoreOp: "store" as GPUStoreOp,
      stentialClearValue: 0,
      stencilLoadOp: "clear" as GPULoadOp,
      stencilStoreOp: "store" as GPUStoreOp,
    },
  };

  atomBufferNeedClear.reset(false);

  renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
  renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setBindGroup(0, uniformBindGroup);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(info.length);
  passEncoder.end();

  return commandEncoder.finish();
};

export let collectBuffers = (el: LagopusElement, buffers: GPUCommandBuffer[]) => {
  if (el.type === "object") {
    buffers.push(buildCommandBuffer(el));
  } else {
    el.children.forEach((child) => collectBuffers(child, buffers));
  }
};

// 👋 Helper function for creating GPUBuffer(s) out of Typed Arrays
const createBuffer = (arr: Float32Array | Uint16Array, usage: number) => {
  // 📏 Align to 4 bytes (thanks @chrimsonite)
  let desc = {
    size: (arr.byteLength + 3) & ~3,
    // size: 64,
    usage,
    mappedAtCreation: true,
  };
  let device = atomDevice.deref();
  let buffer = device.createBuffer(desc);

  const writeArray = arr instanceof Uint16Array ? new Uint16Array(buffer.getMappedRange()) : new Float32Array(buffer.getMappedRange());
  writeArray.set(arr);
  buffer.unmap();
  return buffer;
};
