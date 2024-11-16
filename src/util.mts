import { atomDevice } from "./global.mjs";

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

// 👋 Helper function for creating GPUBuffer(s) out of Typed Arrays
export const createBuffer = (arr: Float32Array | Uint32Array, usage: number, label: string) => {
  // 📏 Align to 4 bytes (thanks @chrimsonite)
  let desc = {
    label,
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

// a function that takes a spreading list of number or array of number and return a Float32Array
// **each** piece of data should be agliend to 4 bytes according to webgpu buffer requirement
// if size of data is larger than 1, its start position should be aligned to 2 byte
// if size of data is larger than 2, its start position should be aligned to 4 bytes
// this algorithm may not be accurate, but enough for my case
export let makeAlignedFloat32Array = (...data: (number | number[])[]): Float32Array => {
  let result: number[] = [];
  for (let d of data) {
    if (Array.isArray(d)) {
      let size = d.length;
      if (size < 2) {
        result.push(d[0]);
      } else if (size < 4) {
        while (result.length % 2) {
          result.push(0);
        }
        result.push(...d);
      } else {
        while (result.length % 4) {
          result.push(0);
        }
        result.push(...d);
      }
    } else {
      result.push(d);
    }
  }
  while (result.length % 4) {
    result.push(0);
  }
  return new Float32Array(result);
};
