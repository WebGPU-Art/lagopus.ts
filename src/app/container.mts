import triangleWgsl from "../../shaders/triangle.wgsl";
import imageWgsl from "../../shaders/image.wgsl";
import blinkWgsl from "../../shaders/blink.wgsl";
import triangleComputeWgsl from "../../shaders/triangle-compute.wgsl";

import { flattenData, group, object } from "../alias.mjs";
import { LagopusElement, LagopusRenderer, V3 } from "../primes.mjs";
import { compButton, compSlider, compDragPoint, compFlatButton } from "../comp/button.mjs";
import { makeAlignedFloat32Array } from "../util.mjs";

export let compContainer = (store: { position: V3 }, resources: Record<string, GPUTexture>): LagopusRenderer => {
  return group(
    null,
    object({
      label: "triangle",
      shader: triangleWgsl,
      topology: "triangle-list",
      // topology: "line-strip",
      attrsList: [
        { field: "position", format: "float32x4" },
        { field: "color", format: "float32x4" },
      ],
      data: [
        { position: [-100.0, -100.0, 0.3, 1], color: [1, 0, 0, 1] },
        { position: [-0.0, 100.0, 100, 1], color: [1, 1, 0, 1] },
        { position: [100.0, -100.0, -100, 1], color: [0, 0, 1, 1] },
      ],
    }),
    null,
    object({
      label: "triangle",
      shader: triangleWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4" },
        { field: "color", format: "float32x4" },
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
      label: "triangle",
      shader: triangleWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4" },
        { field: "color", format: "float32x4" },
      ],
      data: [
        { position: [100.0, 180.0, 0, 1], color: [1, 0, 0, 1] },
        { position: [108.0, 180.0, 0, 1], color: [0, 1, 0, 1] },
        { position: [100.0, 188.0, 8, 1], color: [0, 0, 1, 1] },
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

    object({
      label: "blink",
      shader: blinkWgsl,
      topology: "triangle-list",
      attrsList: [{ field: "position", format: "float32x4" }],
      data: [{ position: [140.0, 0.0, 30, 1] }, { position: [120.0, 20.0, 30, 1] }, { position: [140.0, 40.0, 30, 1] }],
      getParams: () => {
        return [(Date.now() / 400) % 1, 0, 0, 0];
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
    compFlatButton(
      {
        position: [240, 0, 0] as V3,
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
    ),

    object({
      label: "image",
      shader: imageWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4" },
        { field: "uv", format: "float32x2" },
      ],
      textures: [resources["tiye"]],
      data: [
        { position: [120.0, 80.0, 30, 1], uv: [0, 1] },
        { position: [200.0, 80.0, 30, 1], uv: [1, 1] },
        { position: [120.0, 160.0, 30, 1], uv: [0, 0] },
        { position: [200.0, 80.0, 30, 1], uv: [1, 1] },
        { position: [120.0, 160.0, 30, 1], uv: [0, 0] },
        { position: [200.0, 160.0, 30, 1], uv: [1, 0] },
      ],
    }),
    // compute shader example
    object({
      label: "triangle-compute",
      shader: triangleComputeWgsl,
      topology: "triangle-list",
      attrsList: [
        { field: "position", format: "float32x4" },
        { field: "color", format: "float32x4" },
        { field: "pointer", format: "uint32" },
      ],
      data: [
        { position: [60.0, -200.0, 0, 1], color: [1, 0, 0, 1], pointer: 0 },
        { position: [68.0, -200.0, 0, 1], color: [0, 1, 0, 1], pointer: 0 },
        { position: [60.0, -208.0, 8, 1], color: [0, 0, 1, 1], pointer: 0 },
        // another triangle
        { position: [100.0, -200.0, 0, 1], color: [1, 0, 0, 1], pointer: 1 },
        { position: [108.0, -200.0, 0, 1], color: [0, 1, 0, 1], pointer: 1 },
        { position: [100.0, -208.0, 8, 1], color: [0, 0, 1, 1], pointer: 1 },
      ],
      computeOptions: {
        particleCount: 2,
        initialBuffer: makeAlignedFloat32Array(
          // item 1, position, velocity
          [0, 0, 0],
          [1, 0, 0],
          // item 2, position, velocity
          [0, 0, 0],
          [0, 1, 0]
        ),
      },
    })
  );
};
