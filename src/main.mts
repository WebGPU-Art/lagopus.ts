import { initializeContext, paintLagopusTree, renderLagopusTree, resetCanvasHeight } from "./render.mjs";

import { compContainer } from "./app/container.mjs";
import { renderControl, startControlLoop } from "@triadica/touch-control";
import { onControlEvent } from "./control.mjs";
import { setupMouseEvents } from "./events.mjs";
import { Atom } from "./atom.mjs";
import { V3 } from "./primes.mjs";
import { atomClearColor } from "./global.mjs";

let store = new Atom({
  position: [180, 80, 80] as V3,
});

let dispatch = (op: string, data: any) => {
  if (op === "drag") {
    store.deref().position = data;
    renderApp();
  } else {
    console.warn("dispatch", op, data);
  }
};

function renderApp() {
  let tree = compContainer(store.deref());

  renderLagopusTree(tree, dispatch);
}

window.onload = async () => {
  await initializeContext();
  atomClearColor.reset({ r: 1, g: 1, b: 1, a: 1.0 });
  let canvas = document.querySelector("canvas");
  renderApp();
  console.log("loaded");

  renderControl();
  startControlLoop(10, onControlEvent);

  window.onresize = () => {
    resetCanvasHeight(canvas);
    paintLagopusTree();
  };
  resetCanvasHeight(canvas);

  window.__lagopusHandleCompilationInfo = (e, code) => {
    if (e.messages.length) {
      console.error(e);
    }
  };
  setupMouseEvents(canvas);
};

declare global {
  /** dirty hook for extracting error messages */
  var __lagopusHandleCompilationInfo: (info: GPUCompilationInfo, code: string) => void;
}
