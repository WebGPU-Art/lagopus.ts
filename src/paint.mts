import { LagopusElement, LagopusObjectData } from "./primes.mjs";
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

let buildCommandBuffer = (t: number, info: LagopusObjectData): void => {
  let { topology, shaderModule, vertexBuffersDescriptors, vertexBuffers, indices } = info;
  let { computeOptions } = info;

  let device = atomDevice.deref();
  let context = atomContext.deref();
  let depthTexture = atomDepthTexture.deref();

  // create uniforms
  // based on code from https://alain.xyz/blog/raw-webgpu

  let lookAt = newLookatPoint();
  let lookDistance = vLength(lookAt);
  let forward = vNormalize(lookAt);
  let upward = atomViewerUpward.deref();
  let rightward = vCross(forward, atomViewerUpward.deref());
  let viewportRatio = window.innerHeight / window.innerWidth;
  let viewerScale = atomViewerScale.deref();
  let viewerPosition = atomViewerPosition.deref();
  // 👔 Uniform Data
  const uniformData = makeAlignedFloat32Array(coneBackScale, viewportRatio, lookDistance, viewerScale, forward, upward, rightward, viewerPosition);

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

  let uniformEntries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: { buffer: customParamsBuffer } },
  ];

  let uniformBindGroup: GPUBindGroup = device.createBindGroup({
    label: info.label,
    layout: uniformBindGroupLayout,
    entries: uniformEntries,
  });

  let texturesInfo = prepareTextures(device, info.textures, info.label);

  let renderLayout = device.createPipelineLayout({
    label: info.label,
    bindGroupLayouts: [uniformBindGroupLayout, texturesInfo.layout].filter(Boolean),
  });

  //
  // Create render pipeline
  //

  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();
  /** pick uint32 for general usages */
  const stripIndexFormat: GPUIndexFormat = topology === "line-strip" || topology === "triangle-strip" ? "uint32" : undefined;

  const commandEncoder = atomCommandEncoder.deref();

  // Encode compute pass

  if (computeOptions) {
    const particleBuffers: GPUBuffer[] = new Array(2);
    for (let i = 0; i < 2; ++i) {
      particleBuffers[i] = device.createBuffer({
        size: computeOptions.initialBuffer.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
        mappedAtCreation: true,
      });
      new Float32Array(particleBuffers[i].getMappedRange()).set(computeOptions.initialBuffer);
      particleBuffers[i].unmap();
    }

    let computeParticlesLayout = device.createBindGroupLayout({
      entries: computeParticleEntries,
    });

    let { particleBindGroups, mockedBindGroups } = setupParticlesBindGroups(device, computeParticlesLayout, particleBuffers, computeOptions.particleCount);

    const computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [device.createBindGroupLayout({ entries: computeUniformEntries }), computeParticlesLayout],
      }),
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });

    const computePassEncoder = commandEncoder.beginComputePass();
    computePassEncoder.setPipeline(computePipeline);
    computePassEncoder.setBindGroup(
      0,
      device.createBindGroup({
        // pass two uniforms, one for global view options, one for params
        layout: device.createBindGroupLayout({ entries: computeUniformEntries }),
        entries: uniformEntries,
      })
    );
    computePassEncoder.setBindGroup(1, particleBindGroups[t % 2]);
    computePassEncoder.dispatchWorkgroups(Math.ceil(computeOptions.particleCount / 64));
    computePassEncoder.end();
  }

  //
  // Create render pass descriptor
  //

  const renderPipeline = device.createRenderPipeline({
    label: info.label,
    layout: renderLayout,
    vertex: { module: shaderModule, entryPoint: "vertex_main", buffers: vertexBuffersDescriptors },
    fragment: { module: shaderModule, entryPoint: "fragment_main", targets: [{ format: presentationFormat, blend: blendState }] },
    primitive: { topology, stripIndexFormat },
    depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus-stencil8" },
    // multisample: atomBloomEnabled.deref() ? undefined : { count: 4 },
  });

  let needClear = atomBufferNeedClear.deref();
  let loadOp: GPULoadOp = needClear ? "clear" : "load";

  let clearValue = atomClearColor.deref() ?? { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
  let view = atomBloomEnabled.deref() ? atomCanvasTexture.deref().createView() : context.getCurrentTexture().createView();
  // resolveTarget: atomBloomEnabled.deref() ? undefined : context.getCurrentTexture().createView(),
  const renderPassDescriptor: GPURenderPassDescriptor = {
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

  // Encode render pass

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setBindGroup(0, uniformBindGroup);
  if (texturesInfo.bindGroup) {
    // occupies 1 for texture
    passEncoder.setBindGroup(1, texturesInfo.bindGroup);
  }

  passEncoder.setPipeline(renderPipeline);
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

export let collectBuffers = (t: number, el: LagopusElement) => {
  if (el == null) return;
  if (el.type === "object") {
    buildCommandBuffer(t, el);
  } else {
    el.children.forEach((child) => collectBuffers(t, child));
  }
};

let counter = 0;

/** send command buffer to device and render */
export function paintLagopusTree() {
  let device = atomDevice.deref();
  atomCommandEncoder.reset(device.createCommandEncoder());

  atomBufferNeedClear.reset(true);
  let tree = atomLagopusTree.deref();
  collectBuffers(counter, tree);
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

// TODO need to learn more details
// https://github.com/takahirox/webgpu-trial/blob/master/cube_alpha_blend.html#L273
// https://github.com/kdashg/webgpu-js/blob/master/hello-blend.html#L98
let blendState: GPUBlendState = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
};

let computeUniformEntries: GPUBindGroupLayoutEntry[] = [
  { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
  { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
];

/** structure of some ping/pong buffer  */
let computeParticleEntries: GPUBindGroupLayoutEntry[] = [
  { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
  { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
];

/** setup buffer for compute shader,
 * also mock some buffer in render pass
 */
let setupParticlesBindGroups = (device: GPUDevice, layout: GPUBindGroupLayout, particleBuffers: GPUBuffer[], byteLength: number) => {
  const particleBindGroups: GPUBindGroup[] = new Array(2);
  const mockedBindGroups: GPUBindGroup[] = new Array(2);

  for (let i = 0; i < 2; ++i) {
    let fromBuffer = particleBuffers[i % 2];
    let toBuffer = particleBuffers[(i + 1) % 2];
    particleBindGroups[i] = device.createBindGroup({
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: fromBuffer, size: byteLength } },
        { binding: 1, resource: { buffer: toBuffer, size: byteLength } },
      ],
    });
    let emptyBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE,
    });
    let emptyBuffer2 = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE,
    });
    mockedBindGroups[i] = device.createBindGroup({
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: emptyBuffer, size: 4 } },
        { binding: 1, resource: { buffer: emptyBuffer2, size: 4 } },
      ],
    });
  }

  return {
    particleBindGroups,
    mockedBindGroups,
  };
};
