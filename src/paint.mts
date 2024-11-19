import { LagopusElement, LagopusObjectData, LagopusRenderObject } from "./primes.mjs";
import {
  atomDepthTexture,
  atomContext,
  atomDevice,
  atomBufferNeedClear,
  atomLagopusTree,
  atomClearColor,
  atomCanvasTexture,
  atomCommandEncoder,
  atomBloomEnabled,
} from "./global.mjs";
import { coneBackScale } from "./config.mjs";
import { atomViewerPosition, atomViewerScale, atomViewerUpward, newLookatPoint } from "./perspective.mjs";
import { vNormalize, vCross, vLength } from "@triadica/touch-control";

import { clearCanvas } from "./clear";
import { postRendering, prepareTextures } from "./post-rendering.mjs";
import { createBuffer, makeAlignedFloat32Array } from "./util.mjs";

// https://github.com/takahirox/webgpu-trial/blob/master/cube_alpha_blend.html#L273
// https://github.com/kdashg/webgpu-js/blob/master/hello-blend.html#L98
let blendState: GPUBlendState = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
};
export let makePainter = (info: LagopusObjectData): ((l: number) => void) => {
  let { topology, shaderModule, vertexBuffersDescriptors, vertexBuffers, indices } = info;
  let { computeOptions } = info;

  let device = atomDevice.deref();
  let context = atomContext.deref();

  let renderParticlesBindGroupLayout = device.createBindGroupLayout({
    label: info.label + "@render-uniform",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
    ],
  });

  //
  // Create render pipeline
  //

  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();
  /** pick uint32 for general usages */
  const stripIndexFormat: GPUIndexFormat = topology === "line-strip" || topology === "triangle-strip" ? "uint32" : undefined;

  // Encode compute pass

  let computeParticlesLayout = device.createBindGroupLayout({
    label: info.label + "@compute",
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
    ],
  });
  let renderParticlesLayout = device.createBindGroupLayout({
    label: info.label + "@render-particles",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
    ],
  });

  // prepare variables for usages in closure
  let uniformsComputeLayout: GPUBindGroupLayout;
  let computePipeline: GPUComputePipeline;
  let computeParticleBindGroups: GPUBindGroup[];

  let particleBindGroups = mockEmptyParticlesBindGroups(device, renderParticlesBindGroupLayout);

  if (computeOptions) {
    if (!computeOptions.initialBuffer) {
      throw new Error("computeOptions.initialBuffer is undefined");
    }
    const particleBuffers: GPUBuffer[] = new Array(2);
    for (let i = 0; i < 2; ++i) {
      particleBuffers[i] = device.createBuffer({
        label: info.label + "@compute",
        size: computeOptions.initialBuffer.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
        mappedAtCreation: true,
      });
      new Float32Array(particleBuffers[i].getMappedRange()).set(computeOptions.initialBuffer);
      particleBuffers[i].unmap();
    }

    computeParticleBindGroups = setupParticlesBindGroups(device, computeParticlesLayout, particleBuffers, computeOptions.initialBuffer.byteLength);
    // overwrites
    particleBindGroups = setupParticlesBindGroups(device, renderParticlesLayout, particleBuffers, computeOptions.initialBuffer.byteLength);
    uniformsComputeLayout = device.createBindGroupLayout({
      label: info.label + "@compute",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      ],
    });
    computePipeline = device.createComputePipeline({
      label: info.label + "@compute",
      layout: device.createPipelineLayout({
        label: info.label + "@compute",
        bindGroupLayouts: [uniformsComputeLayout, computeParticlesLayout],
      }),
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });
  }

  //
  // Create render pass descriptor
  //

  let texturesInfo = prepareTextures(device, info.textures, info.label);

  let renderUniformBindGroupLayout = device.createBindGroupLayout({
    label: info.label + "@render-uniform",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ],
  });

  const renderPipeline = device.createRenderPipeline({
    label: info.label + "@render",
    layout: device.createPipelineLayout({
      label: info.label + "@render",
      bindGroupLayouts: [renderUniformBindGroupLayout, texturesInfo.layout, computeOptions ? renderParticlesLayout : undefined].filter(Boolean),
    }),
    vertex: { module: shaderModule, entryPoint: "vertex_main", buffers: vertexBuffersDescriptors },
    fragment: { module: shaderModule, entryPoint: "fragment_main", targets: [{ format: presentationFormat, blend: blendState }] },
    primitive: { topology, stripIndexFormat },
    depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus-stencil8" },
    // multisample: atomBloomEnabled.deref() ? undefined : { count: 4 },
  });

  // Encode render pass

  return (loopTimes) => {
    // create uniforms
    // based on code from https://alain.xyz/blog/raw-webgpu

    let lookAt = newLookatPoint();
    let lookDistance = vLength(lookAt);
    let forward = vNormalize(lookAt);
    let upward = atomViewerUpward.deref();
    let rightward = vCross(forward, upward);
    let viewportRatio = window.innerHeight / window.innerWidth;
    let viewerScale = atomViewerScale.deref();
    let viewerPosition = atomViewerPosition.deref();
    // 👔 Uniform Data
    const uniformData = makeAlignedFloat32Array(coneBackScale, viewportRatio, lookDistance, viewerScale, forward, upward, rightward, viewerPosition);
    const customParams = makeAlignedFloat32Array(info.getParams?.() || [0]);

    let uniformBuffer = createBuffer(uniformData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, "uniform");
    let customParamsBuffer = createBuffer(customParams, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, "params");

    let uniformEntries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: customParamsBuffer } },
    ];

    const commandEncoder = atomCommandEncoder.deref();

    // now compute
    if (computeOptions) {
      const computePassEncoder = commandEncoder.beginComputePass();
      computePassEncoder.setPipeline(computePipeline);
      computePassEncoder.setBindGroup(
        0,
        device.createBindGroup({
          label: info.label + "@compute",
          // pass two uniforms, one for global view options, one for params
          layout: uniformsComputeLayout,
          entries: uniformEntries,
        })
      );
      computePassEncoder.setBindGroup(1, computeParticleBindGroups[loopTimes % 2]);
      computePassEncoder.dispatchWorkgroups(Math.ceil(computeOptions.particleCount / 64));
      computePassEncoder.end();
    }

    // now paint

    let needClear = atomBufferNeedClear.deref();
    let loadOp: GPULoadOp = needClear ? "clear" : "load";
    let clearValue = atomClearColor.deref() ?? { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };

    let depthTexture = atomDepthTexture.deref();

    let view = atomBloomEnabled.deref() ? atomCanvasTexture.deref().createView() : context.getCurrentTexture().createView();
    // resolveTarget: atomBloomEnabled.deref() ? undefined : context.getCurrentTexture().createView(),
    const renderPassDescriptor: GPURenderPassDescriptor = {
      label: info.label + "@render",
      colorAttachments: [{ clearValue, loadOp: loadOp, storeOp: "store" as GPUStoreOp, view }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: loadOp,
        depthStoreOp: "store",
        stencilLoadOp: "clear",
        stencilStoreOp: "store",
      },
    };

    atomBufferNeedClear.reset(false);

    const renderEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    let renderUniformBindGroup: GPUBindGroup = device.createBindGroup({
      label: info.label + "@uniform",
      layout: renderUniformBindGroupLayout,
      entries: uniformEntries,
    });

    renderEncoder.setPipeline(renderPipeline);
    renderEncoder.setBindGroup(0, renderUniformBindGroup);
    if (texturesInfo.bindGroup) {
      // occupies 1 for texture
      renderEncoder.setBindGroup(1, texturesInfo.bindGroup);
    }
    if (computeOptions) {
      renderEncoder.setBindGroup(1, particleBindGroups[loopTimes % 2]);
    }

    // let w = window.innerWidth * devicePixelRatio;
    // let h = window.innerHeight * devicePixelRatio;
    // this.passEncoder.setViewport(0, 0, w, h, 0, 1);
    // this.passEncoder.setScissorRect(0, 0, w, h);
    vertexBuffers.forEach((vertexBuffer, idx) => {
      renderEncoder.setVertexBuffer(idx, vertexBuffer);
    });

    if (indices) {
      // just use uint32, skip uint16
      renderEncoder.setIndexBuffer(indices, "uint32");
      renderEncoder.drawIndexed(indices.size / 4);
    } else {
      renderEncoder.draw(info.length);
    }
    renderEncoder.end();
  };
};

export let triggerRendering = (t: number, el: LagopusRenderObject) => {
  if (el == null) return;
  if (el.type === "object") {
    el.renderer(t);
  } else {
    el.children.forEach((child) => triggerRendering(t, child));
  }
};

let counter = 0;

/** send command buffer to device and render */
export function paintLagopusTree() {
  let device = atomDevice.deref();
  atomCommandEncoder.reset(device.createCommandEncoder({ label: "lagopus shared" }));

  atomBufferNeedClear.reset(true);
  let tree = atomLagopusTree.deref();
  triggerRendering(counter, tree);
  counter += 1;

  if (atomBufferNeedClear.deref()) {
    clearCanvas();
  } else if (atomBloomEnabled.deref()) {
    postRendering();
  }
  // load shared device
  let commandEncoder = atomCommandEncoder.deref();
  device.queue.submit([commandEncoder.finish()]);
}

/** setup buffer for compute shader */
let setupParticlesBindGroups = (device: GPUDevice, layout: GPUBindGroupLayout, particleBuffers: GPUBuffer[], byteLength: number) => {
  const particleBindGroups: GPUBindGroup[] = new Array(2);

  for (let i = 0; i < 2; ++i) {
    let fromBuffer = particleBuffers[i % 2];
    let toBuffer = particleBuffers[(i + 1) % 2];
    particleBindGroups[i] = device.createBindGroup({
      label: "shared",
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: fromBuffer, size: byteLength } },
        { binding: 1, resource: { buffer: toBuffer, size: byteLength } },
      ],
    });
  }

  return particleBindGroups;
};

export let mockEmptyParticlesBindGroups = (device: GPUDevice, layout: GPUBindGroupLayout) => {
  const mockedBindGroups: GPUBindGroup[] = new Array(2);

  let emptyBuffer = device.createBuffer({ label: "mock", size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM });
  for (let i = 0; i < 2; ++i) {
    mockedBindGroups[i] = device.createBindGroup({
      label: "mocked",
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: emptyBuffer, size: 4 } },
        { binding: 1, resource: { buffer: emptyBuffer, size: 4 } },
      ],
    });
  }

  return mockedBindGroups;
};
