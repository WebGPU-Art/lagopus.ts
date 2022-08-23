import { createRenderer } from "./render.mjs";
import { LagopusObjectData, LagopusObjectOptions, LagopusGroup } from "./primes.mjs";

export let group = (options: any, ...children: any[]): LagopusGroup => {
  return {
    type: "group",
    children,
  };
};

export let object = (options: LagopusObjectOptions): LagopusObjectData => {
  return createRenderer(options.shader, options.topology, options.attrsList, options.data);
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
