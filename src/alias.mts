import { createRenderer } from "./render.mjs";
import { LagopusObjectData, LagopusObjectOptions, LagopusGroup } from "./primes.mjs";

export let group = (options: any, ...children: any[]): LagopusGroup => {
  return {
    type: "group",
    children,
  };
};

/** create a render object */
export let object = (options: LagopusObjectOptions): LagopusObjectData => {
  let { attrsList, data } = options;

  let buffers = attrsList.map((attr) => {
    var buffer = newBufferFormatLength(attr.format, data.length);

    var pointer = 0;
    for (let i = 0; i < data.length; i++) {
      let v = data[i][attr.field];
      for (let j = 0; j < v.length; j++) {
        buffer[pointer] = v[j];
        pointer += 1;
      }
    }

    return buffer;
  });

  var indices: Uint32Array;
  if (options.indices) {
    indices = u32buffer(options.indices);
  }

  return createRenderer(options.shader, options.topology, options.attrsList, data.length, buffers, options.hitRegion, indices);
};

export type NestedData<T> = NestedData<T>[] | T;

/** to support passing nested data */
export function flattenData<T>(data: NestedData<T>, collect?: (d: T) => void): T[] {
  if (collect != null) {
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        flattenData(data[i], collect);
      }
    } else {
      collect(data);
    }
    return null;
  } else {
    let ret: Array<T> = [];
    let collector = (d: T) => {
      ret.push(d);
    };

    flattenData(data, collector);
    return ret;
  }
}

export function u32buffer(data: number[]): Uint32Array {
  let ret = new Uint32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    ret[i] = data[i];
  }
  return ret;
}

export function newBufferFormatLength(format: GPUVertexFormat, size: number): Float32Array | Uint32Array {
  if (format === "float32") {
    return new Float32Array(size);
  } else if (format === "float32x2") {
    return new Float32Array(size * 2);
  } else if (format === "float32x3") {
    return new Float32Array(size * 3);
  } else if (format === "float32x4") {
    return new Float32Array(size * 4);
  } else if (format === "uint32") {
    return new Uint32Array(size);
  } else {
    throw new Error(`unsupported format ${format}`);
  }
}
