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

  // extra array, extra cost
  let tmp: number[] = [];
  for (let i = 0; i < data.length; i++) {
    for (let a = 0; a < attrsList.length; a++) {
      tmp.push(...data[i][attrsList[a].field]);
    }
  }
  let vertices = new Float32Array(tmp.length);
  for (let i = 0; i < tmp.length; i++) {
    vertices[i] = tmp[i];
  }

  return createRenderer(options.shader, options.topology, options.attrsList, data.length, vertices, options.hitRegion);
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
