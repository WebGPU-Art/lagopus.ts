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
    var buffer: Float32Array | Uint32Array;
    let format = attr.format;
    if (format === "float32") {
      buffer = new Float32Array(data.length);
    } else if (format === "float32x2") {
      buffer = new Float32Array(data.length * 2);
    } else if (format === "float32x3") {
      buffer = new Float32Array(data.length * 3);
    } else if (format === "float32x4") {
      buffer = new Float32Array(data.length * 4);
    } else if (format === "uint32") {
      buffer = new Uint32Array(data.length);
    } else {
      throw new Error(`unsupported format ${format}`);
    }

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

  return createRenderer(options.shader, options.topology, options.attrsList, data.length, buffers, options.hitRegion);
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
