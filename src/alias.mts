import { createRenderer } from "./render.mjs";
import { LagopusObjectData, LagopusObjectOptions, LagopusGroup } from "./primes.mjs";

export let group = (options: any, ...children: any[]): LagopusGroup => {
  return {
    type: "group",
    children,
  };
};

export let object = (options: LagopusObjectOptions): LagopusObjectData => {
  let buffer = createRenderer(options.shader, options.topology, options.attrsList, options.data);

  return {
    type: "object",
    buffer,
  };
};
