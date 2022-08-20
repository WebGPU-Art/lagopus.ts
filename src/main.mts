import triangleWgsl from "../shaders/triangle.wgsl";

import { atomDevice } from "./global.mjs";
import { initializeContext, createRenderer } from "./render.mjs";

// ~~ Define render loop ~~
function frame() {
  // ~~ SETUP VERTICES (position (vec3<f32>), color(vec4<i32>)) ~~
  // Pack them all into one array
  // Each vertex has a position and a color packed in memory in X Y Z W R G B A order

  let commandBuffer = createRenderer(
    triangleWgsl,
    "triangle-list",
    [
      { field: "position", format: "float32x4", size: 4 },
      { field: "color", format: "float32x4", size: 4 },
    ],
    [
      { position: [-1.0, -1.0, 0.3, 1], color: [1, 0, 0, 1] },
      { position: [-0.0, 1.0, 0.3, 1], color: [1, 1, 0, 1] },
      { position: [1.0, -1.0, 0.3, 1], color: [0, 0, 1, 1] },
    ]
  );

  let commandBuffer2 = createRenderer(
    triangleWgsl,
    "triangle-list",
    [
      { field: "position", format: "float32x4", size: 4 },
      { field: "color", format: "float32x4", size: 4 },
    ],
    [
      { position: [-1.0, 1.0, 0.4, 1], color: [1, 0, 0, 1] },
      { position: [-0.0, -1.0, 0.4, 1], color: [1, 1, 0, 1] },
      { position: [1.0, 1.0, 0.4, 1], color: [0, 0, 1, 1] },
    ]
  );

  // load shared device
  let device = atomDevice.deref();
  device.queue.submit([commandBuffer, commandBuffer2]);

  // requestAnimationFrame(frame);
}

window.onload = async () => {
  await initializeContext();
  frame();
};
console.log("loaded");
