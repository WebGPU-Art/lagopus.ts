import queryString from "query-string";
import { createTextureFromSource, paintLagopusTree, renderLagopusTree, resetCanvasSize } from "./render.mjs";
import { enableBloom, initializeCanvasTextures, initializeContext } from "./initialize.js";

import { compContainer } from "./app/container.mjs";
import { renderControl, startControlLoop } from "@triadica/touch-control";
import { loadGamepadControl, onControlEvent } from "./control.mjs";
import { setupMouseEvents } from "./events.mjs";
import { Atom } from "@triadica/touch-control";
import { V3 } from "./primes.mjs";
import { atomClearColor } from "./global.mjs";
import { isMobile, parsedQuery } from "./config.mjs";
import { setupRemoteControl } from "./remote-control.mjs";

let store = new Atom({
  position: [180, 80, 80] as V3,
});

let resources: Record<string, GPUTexture> = {};

let dispatch = (op: string, data: any) => {
  if (op === "drag") {
    store.deref().position = data;
    renderApp();
  } else {
    console.warn("dispatch", op, data);
  }
};

function renderApp() {
  let tree = compContainer(store.deref(), resources);

  renderLagopusTree(tree, dispatch);
}

let loadTextures = async (device: GPUDevice) => {
  const response = await fetch("https://cdn.tiye.me/logo/tiye.jpg");
  const imageBitmap = await createImageBitmap(await response.blob());
  let texture = createTextureFromSource(device, {
    source: imageBitmap,
    w: imageBitmap.width,
    h: imageBitmap.height,
  });
  resources["tiye"] = texture;
};

window.onload = async () => {
  if (!isMobile) {
    // enableBloom();
  }

  let context = await initializeContext();

  await loadTextures(context.device);

  initializeCanvasTextures();
  atomClearColor.reset({ r: 0.0, g: 0.0, b: 0.0, a: 0.0 });
  let canvas = document.querySelector("canvas");
  renderApp();
  console.log("loaded");

  renderControl();
  startControlLoop(10, onControlEvent);

  window.onresize = () => {
    resetCanvasSize(canvas);
    initializeCanvasTextures();
    paintLagopusTree();
  };
  resetCanvasSize(canvas);

  window.__lagopusHandleCompilationInfo = (e, code) => {
    if (e.messages.length) {
      console.error(e);
    }
  };
  setupMouseEvents(canvas);

  if (parsedQuery["remote-control"]) {
    setupRemoteControl((action) => {
      console.log("Action", action);
    });
  }

  loadGamepadControl();
  paintLagopusTree();
};

declare global {
  /** dirty hook for extracting error messages */
  var __lagopusHandleCompilationInfo: (info: GPUCompilationInfo, code: string) => void;
}
