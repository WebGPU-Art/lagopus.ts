import { moveViewerBy, rotateGlanceBy, spinGlanceBy } from "./perspective.mjs";
import { V2 } from "./primes.mjs";
import { atomBufferNeedClear, atomDevice, atomLagopusTree } from "./global.mjs";
import { collectBuffers } from "./render.mjs";
import { ControlStates } from "@triadica/touch-control";

export function paintApp() {
  atomBufferNeedClear.reset(true);
  let tree = atomLagopusTree.deref();
  let bufferList: GPUCommandBuffer[] = [];
  collectBuffers(tree, bufferList);

  // load shared device
  let device = atomDevice.deref();
  device.queue.submit(bufferList);
}

export let onControlEvent = (elapsed: number, states: ControlStates, delta: ControlStates) => {
  let lMove = states.leftMove.map(refineStrength) as V2;
  let rMove = states.rightMove.map(refineStrength) as V2;
  let rDelta = delta.rightMove;
  let lDelta = delta.leftMove;
  let leftA = states.leftA;
  let rightA = states.rightA || states.shift;
  let rightB = states.rightB;
  let leftB = states.leftB;
  if (lMove[1] !== 0) {
    moveViewerBy(0, 0, -2 * elapsed * lMove[1]);
  }
  if (lMove[0] !== 0) {
    rotateGlanceBy(-0.05 * elapsed * lMove[0], 0);
  }
  if (!rightA && !isZero(rMove)) {
    moveViewerBy(2 * elapsed * rMove[0], 2 * elapsed * rMove[1], 0);
  }
  if (rightA && rMove[1] !== 0) {
    rotateGlanceBy(0, 0.05 * elapsed * rMove[1]);
  }
  if (rightA && rMove[0] !== 0) {
    spinGlanceBy(-0.05 * elapsed * rMove[0]);
  }
  if (!isZero(lMove) || !isZero(rMove)) {
    paintApp();
  }
};

let isZero = (v: V2): boolean => {
  return v[0] === 0 && v[1] === 0;
};

let refineStrength = (x: number): number => {
  return x * Math.sqrt(Math.abs(x * 0.02));
};
