import {
  atomDevice,
  atomContext,
  atomCanvasTexture,
  atomDepthTexture,
  atomFilterTexture,
  atomPingBuffer,
  atomScreenFilterBuffer,
  atomPongBuffer,
  atomPingTexture,
  atomPongTexture,
  atomBloomEnabled,
} from "./global.mjs";

/** init canvas context */
export const initializeContext = async () => {
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

  return { device };
};

/** create a texture for canvas */
export function initializeCanvasTextures() {
  let device = atomDevice.deref();
  let width = window.innerWidth * devicePixelRatio;
  let height = window.innerHeight * devicePixelRatio;

  const depthTexture = device.createTexture({
    size: [width, height],
    // format: "depth24plus",
    // usage: GPUTextureUsage.RENDER_ATTACHMENT,
    dimension: "2d",
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    // sampleCount: atomBloomEnabled.deref() ? undefined : 4,
  });

  atomDepthTexture.reset(depthTexture);

  let texture = device.createTexture({
    size: [width, height],
    format: "bgra8unorm",
    // sampleCount: atomBloomEnabled.deref() ? undefined : 4,
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  atomCanvasTexture.reset(texture);

  if (!atomBloomEnabled.deref()) {
    // disabled
    return;
  }

  let filterTexture = device.createTexture({
    size: [width, height],
    format: "bgra8unorm",

    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    // usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
  });
  atomFilterTexture.reset(filterTexture);

  const buffer0 = (() => {
    const buffer = device.createBuffer({
      size: 4,
      mappedAtCreation: true,
      usage: GPUBufferUsage.UNIFORM,
    });
    new Uint32Array(buffer.getMappedRange())[0] = 0;
    buffer.unmap();
    return buffer;
  })();

  const buffer1 = (() => {
    const buffer = device.createBuffer({
      size: 4,
      mappedAtCreation: true,
      usage: GPUBufferUsage.UNIFORM,
    });
    new Uint32Array(buffer.getMappedRange())[0] = 1;
    buffer.unmap();
    return buffer;
  })();

  const buffer2 = (() => {
    const buffer = device.createBuffer({
      size: 4,
      mappedAtCreation: true,
      usage: GPUBufferUsage.UNIFORM,
    });
    new Uint32Array(buffer.getMappedRange())[0] = 1;
    buffer.unmap();
    return buffer;
  })();

  atomPingBuffer.reset(buffer0);
  atomPongBuffer.reset(buffer1);
  atomScreenFilterBuffer.reset(buffer2);

  let pingTexture = device.createTexture({
    size: [width, height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
  });

  let pongTexture = device.createTexture({
    size: [width, height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
  });

  atomPingTexture.reset(pingTexture);
  atomPongTexture.reset(pongTexture);
}

/** enabled bloom effect */
export function enableBloom() {
  atomBloomEnabled.reset(true);
}
