import triangleWgsl from "../../shaders/triangle.wgsl";

import { flattenData, group, object } from "../alias.mjs";
import { LagopusElement } from "../primes.mjs";

export let compContainer = (): LagopusElement => {
  return group(
    null,

    object({
      shader: triangleWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4", size: 4 },
        { field: "color", format: "float32x4", size: 4 },
      ],
      data: [
        { position: [-100.0, -100.0, 0.3, 1], color: [1, 0, 0, 1] },
        { position: [-0.0, 100.0, 300, 1], color: [1, 1, 0, 1] },
        { position: [100.0, -100.0, -300, 1], color: [0, 0, 1, 1] },
      ],
    }),

    object({
      shader: triangleWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4", size: 4 },
        { field: "color", format: "float32x4", size: 4 },
      ],
      data: flattenData([
        [
          { position: [-100.0, 100.0, 0.4, 1], color: [1, 0, 0, 1] },
          { position: [-0.0, -100.0, 0.4, 1], color: [1, 1, 0, 1] },
          { position: [100.0, 100.0, 0.4, 1], color: [0, 0, 1, 1] },
        ],
        [
          { position: [-300.0, 100.0, 0.4, 1], color: [1, 0, 0, 1] },
          { position: [-300.0, -100.0, 0.4, 1], color: [1, 1, 0, 1] },
          { position: [-100.0, 100.0, 0.4, 1], color: [0, 0, 1, 1] },
        ],
      ]),
    })
  );
};
