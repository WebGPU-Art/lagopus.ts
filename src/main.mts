import { atomBufferNeedClear, atomDevice, atomLagopusTree, atomObjectsTree, atomProxiedDispatch } from "./global.mjs";
import { initializeContext, collectBuffers } from "./render.mjs";

import { compContainer } from "./app/container.mjs";
import { renderControl, startControlLoop } from "@triadica/touch-control";
import { onControlEvent, paintApp } from "./control.mjs";
import { setupMouseEvents } from "./events.mjs";
import { Atom } from "./atom.mjs";
import { V3 } from "./primes.mjs";

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
  atomLagopusTree.reset(tree);
  atomProxiedDispatch.reset(dispatch);
  atomObjectsTree.reset(tree);
  paintApp();
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

  window.__lagopusHandleCompilationInfo = (e, code) => {
    if (e.messages.length) {
      console.error(e);
    }
  };
  let canvas = document.querySelector("canvas");
  setupMouseEvents(canvas);
};

declare global {
  /** dirty hook for extracting error messages */
  var __lagopusHandleCompilationInfo: (info: GPUCompilationInfo, code: string) => void;
}
