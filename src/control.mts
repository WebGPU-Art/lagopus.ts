import { atomViewerScale, changeScaleBy, moveViewerBy, rotateGlanceBy, spinGlanceBy } from "./perspective.mjs";
import { V2 } from "./primes.mjs";
import { ControlStates } from "@triadica/touch-control";
import { paintLagopusTree } from "./paint.mjs";
import { setupGamepadControl } from "./gamepad";
import { threshold } from "./config.mjs";

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
  if (!rightA && !rightB && !isZero(rMove)) {
    moveViewerBy(2 * elapsed * rMove[0], 2 * elapsed * rMove[1], 0);
  }
  if (rightA && !rightB && rMove[1] !== 0) {
    rotateGlanceBy(0, 0.05 * elapsed * rMove[1]);
  }
  if (rightA && !rightB && rMove[0] !== 0) {
    spinGlanceBy(-0.05 * elapsed * rMove[0]);
  }
  if (!rightA && rightB && rMove[0] !== 0) {
    changeScaleBy(0.01 * elapsed * rMove[0]);
  }
  if (!isZero(lMove) || !isZero(rMove)) {
    paintLagopusTree();
  }
};

let isZero = (v: V2): boolean => {
  return v[0] === 0 && v[1] === 0;
};

let refineStrength = (x: number): number => {
  return x * Math.sqrt(Math.abs(x * 0.02));
};

/** function to catch shader compilation errors */
export function registerShaderResult(f: (e: GPUCompilationInfo, code: string) => void) {
  window.__lagopusHandleCompilationInfo = f;
}

/** listen to gamepad events */
export let loadGamepadControl = () => {
  setupGamepadControl((axes, buttons) => {
    let toMove = false;
    let someValue = (x: number) => {
      if (Math.abs(x) > threshold) {
        toMove = true;
        return x;
      } else {
        return 0;
      }
    };
    let someSwitch = (x: boolean): boolean => {
      if (x) {
        toMove = true;
      }
      return x;
    };
    let scale = atomViewerScale.deref();
    let speedy = buttons.l1.value > 0.5 || buttons.r1.value > 0.5 ? 8 : 1;
    let faster = speedy > 4 ? 4 : 1;
    let ss = speedy / scale;
    // left/right, up/down, front/back
    moveViewerBy(someValue(axes.rightX) * 10 * ss, -someValue(axes.rightY) * 10 * ss, someValue(axes.leftY) * 10 * ss);
    rotateGlanceBy(-0.1 * faster * someValue(axes.leftX), 0.05 * faster * someValue(buttons.up.value - buttons.down.value));

    spinGlanceBy(0.1 * faster * someValue(buttons.right.value - buttons.left.value));

    if (someSwitch(buttons.l2.value > 0.5)) {
      changeScaleBy(0.01 * speedy);
    }
    if (someSwitch(buttons.r2.value > 0.5)) {
      changeScaleBy(-0.01 * speedy);
    }
    if (toMove) {
      paintLagopusTree();
    }
  });
  console.info("Gamepad control ready.");
};
