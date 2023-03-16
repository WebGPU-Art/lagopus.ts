import triangleWgsl from "../../shaders/triangle.wgsl";

import { flattenData, group, object } from "../alias.mjs";
import { LagopusElement, V3 } from "../primes.mjs";
import { compButton, compSlider, compDragPoint } from "../comp/button.mjs";

export let compContainer = (store: { position: V3 }): LagopusElement => {
  return group(
    null,
    object({
      shader: triangleWgsl,
      topology: "triangle-list",
      // topology: "line-strip",
      attrsList: [
        { field: "position", format: "float32x4", size: 4 },
        { field: "color", format: "float32x4", size: 4 },
      ],
      data: [
        { position: [-100.0, -100.0, 0.3, 1], color: [1, 0, 0, 1] },
        { position: [-0.0, 100.0, 100, 1], color: [1, 1, 0, 1] },
        { position: [100.0, -100.0, -100, 1], color: [0, 0, 1, 1] },
      ],
    }),
    null,
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
      // indices: [0, 1, 2],
      // indices: [3, 4, 5],
      // indices: [0, 1, 2, 3, 4, 5],
    }),
    object({
      shader: triangleWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4", size: 4 },
        { field: "color", format: "float32x4", size: 4 },
      ],
      data: [
        { position: [120.0, 120.0, 30, 1], color: [1, 0, 0, 1] },
        { position: [128.0, 120.0, 30, 1], color: [1, 0, 0, 1] },
        { position: [120.0, 126.0, 38, 1], color: [1, 0, 0, 1] },
      ],
      hitRegion: {
        radius: 4,
        position: [124, 123, 34],
        onHit: (e, d) => {
          console.log("hit", e);
          d("hit", { x: e.clientX, y: e.clientY });
        },
      },
    }),
    compButton(
      {
        position: [100, -40, 0] as V3,
        size: 10,
      },
      (e, d) => {
        console.log("clicked", e, d);
      }
    ),
    compSlider(
      {
        position: [140, -40, 0] as V3,
        size: 10,
      },
      (e, d) => {
        console.log("slide", e, d);
      }
    ),
    compDragPoint(
      {
        position: store.position as V3,
        size: 10,
      },
      (newPos, d) => {
        d("drag", newPos);
      }
    )
  );
};
