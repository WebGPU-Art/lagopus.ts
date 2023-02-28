import { atomBufferNeedClear, atomDevice, atomLagopusTree } from "./global.mjs";
import { initializeContext, collectBuffers } from "./render.mjs";

import { compContainer } from "./app/container.mjs";
import { renderControl, startControlLoop } from "@triadica/touch-control";
import { onControlEvent, paintApp } from "./control.mjs";

function renderApp() {
  let tree = compContainer();
  atomLagopusTree.reset(tree);
}

window.onload = async () => {
  await initializeContext();
  renderApp();
  paintApp();
  console.log("loaded");

  renderControl();
  startControlLoop(10, onControlEvent);

  window.onresize = () => {
    paintApp();
  };
};
