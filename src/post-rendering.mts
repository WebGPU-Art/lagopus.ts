import fullscreenWgsl from "../shaders/fullscreen.wgsl";
import blurWGSL from "../shaders/blur.wgsl";
import screenFilterWgsl from "../shaders/screen-filter.wgsl";

import { atomContext, atomDevice, atomCanvasTexture, atomPingBuffer, atomPongBuffer, atomFilterTexture, atomPingTexture, atomPongTexture } from "./global.mjs";

/** based on code https://webgpu.github.io/webgpu-samples/?sample=imageBlur#fullscreenTexturedQuad.wgsl */
export function prepareTextures(device: GPUDevice, textures: GPUTexture[], label: string) {
  let textureBindGroup: GPUBindGroup = undefined;
  let layout: GPUBindGroupLayout = undefined;

  if (textures && textures[0]) {
    let entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      } as GPUBindGroupLayoutEntry,
    ].concat(
      textures.map((texture, idx) => {
        return {
          binding: idx + 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float", viewDimension: "2d", multisampled: false },
        };
      })
    );
    layout = device.createBindGroupLayout({ label: label, entries });

    const sampler = device.createSampler({
      label: label,
      magFilter: "linear",
      minFilter: "linear",
    });

    textureBindGroup = device.createBindGroup({
      label: label,
      layout,
      entries: [
        {
          binding: 0,
          resource: sampler,
        } as GPUBindGroupEntry,
      ].concat(
        textures.map((texture, idx) => {
          return {
            binding: idx + 1,
            resource: texture.createView(),
          };
        })
      ),
    });
  }

  return {
    layout,
    bindGroup: textureBindGroup,
  };
}

/** was an experimental feature that is not enabled */
export function postRendering(commandEncoder: GPUCommandEncoder) {
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
