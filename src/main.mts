import { atomDevice } from "./global.mjs";
import { initializeContext, collectBuffers } from "./render.mjs";

import { compContainer } from "./app/container.mjs";

function renderApp() {
  let bufferList: GPUCommandBuffer[] = [];
  let tree = compContainer();
  collectBuffers(tree, bufferList);

  // load shared device
  let device = atomDevice.deref();
  device.queue.submit(bufferList);
}

window.onload = async () => {
  await initializeContext();
  renderApp();
  console.log("loaded");
};
