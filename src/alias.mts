import { createRenderer } from "./renderer.mjs";
import { LagopusObjectOptions, LagopusRenderObject } from "./primes.mjs";

export let group = (options: any, ...children: any[]): LagopusRenderObject => {
  return {
    type: "group",
    children,
  };
};

/**
 * @param options.label - Identifier for the renderer (defaults to "default")
 * @param options.computeOptions - Configuration for compute shader operations
 */
export let object = (options: LagopusObjectOptions): LagopusRenderObject => {
  let { attrsList, data } = options;

  let buffers = attrsList.map((attr) => {
    var buffer = newBufferFormatLength(attr.format, data.length);

    var pointer = 0;
    for (let i = 0; i < data.length; i++) {
      let v = data[i][attr.field];
      if (Array.isArray(v)) {
        if (pointer + v.length > buffer.length) {
          throw new Error(`Buffer overflow: trying to write ${v.length} elements at position ${pointer} in buffer of length ${buffer.length}`);
        }
        for (let j = 0; j < v.length; j++) {
          buffer[pointer] = v[j];
          pointer += 1;
        }
      } else {
        if (pointer >= buffer.length) {
          throw new Error(`Buffer overflow: trying to write at position ${pointer} in buffer of length ${buffer.length}`);
        }
        buffer[pointer] = v;
        pointer += 1;
      }
    }

    return buffer;
  });

  var indices: Uint32Array;
  if (options.indices) {
    indices = u32buffer(options.indices);
  }

  let getParams = options.getParams || options.addUniform;

  return createRenderer(
    options.shader,
    options.topology,
    options.attrsList,
    data.length,
    buffers,
    options.hitRegion,
    indices,
    getParams,
    options.textures,
    options.label || "default",
    options.computeOptions
  );
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

export function newBufferFormatArray(format: GPUVertexFormat, data: number[]): Float32Array | Uint32Array {
  if (format === "float32") {
    return Float32Array.from(data);
  } else if (format === "float32x2") {
    return Float32Array.from(data);
  } else if (format === "float32x3") {
    return Float32Array.from(data);
  } else if (format === "float32x4") {
    return Float32Array.from(data);
  } else if (format === "uint32") {
    return Uint32Array.from(data);
  } else {
    throw new Error(`unsupported format ${format}`);
  }
}
