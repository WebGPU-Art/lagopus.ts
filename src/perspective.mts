import { vCross, vDot, vScale, vAdd, vSub } from "@triadica/touch-control";
import { coneBackScale } from "./config.mjs";
import { Atom } from "@triadica/touch-control";
import { V3 } from "./primes.mjs";
import { RetainedAtom } from "./retained-atom.mjs";

let perspectiveKey = "lagopus.perspective.";

export let atomViewerForward = new RetainedAtom<V3>(`${perspectiveKey}forward`, [0, 0, -1]);

export let atomViewerPosition = new RetainedAtom<V3>(`${perspectiveKey}position`, [0, 0, 600]);

export let atomViewerUpward = new RetainedAtom<V3>(`${perspectiveKey}upward`, [0, 1, 0]);

export let atomViewerScale = new RetainedAtom<number>(`${perspectiveKey}scale`, 1);

export let moveViewerBy = (x0: number, y0: number, z0: number) => {
  let moveRatio = 1 / atomViewerScale.deref();
  let dv = toViewerAxis(x0, y0, z0);
  let position = atomViewerPosition.deref();
  atomViewerPosition.reset(vAdd(position, vScale(dv, moveRatio)));
};

export let newLookatPoint = (): V3 => {
  return vScale(atomViewerForward.deref(), 600);
};

export let rotateGlanceBy = (x: number, y: number) => {
  let moveRatio = 1 / atomViewerScale.deref();
  if (x !== 0) {
    let da = x * 0.1 * moveRatio;
    let forward = atomViewerForward.deref();
    let upward = atomViewerUpward.deref();
    let rightward = vCross(upward, forward);
    atomViewerForward.reset(vAdd(vScale(forward, Math.cos(da)), vScale(rightward, Math.sin(da))));
  }
  if (y !== 0) {
    let da = y * 0.1 * moveRatio;
    let forward = atomViewerForward.deref();
    let upward = atomViewerUpward.deref();
    atomViewerForward.reset(vAdd(vScale(forward, Math.cos(da)), vScale(upward, Math.sin(da))));
    atomViewerUpward.reset(vAdd(vScale(upward, Math.cos(da)), vScale(forward, -Math.sin(da))));
  }
};

export let spinGlanceBy = (v: number) => {
  if (v !== 0) {
    let moveRatio = 1 / atomViewerScale.deref();
    let da = v * 0.1 * moveRatio;
    let forward = atomViewerForward.deref();
    let upward = atomViewerUpward.deref();
    let rightward = vCross(upward, forward);
    atomViewerUpward.reset(vAdd(vScale(upward, Math.cos(da)), vScale(rightward, Math.sin(da))));
  }
};

export let changeScaleBy = (v: number) => {
  let next = atomViewerScale.deref() + atomViewerScale.deref() * v;
  if (next >= 0.1) {
    atomViewerScale.reset(next);
  }
};

export let toViewerAxis = (x: number, y: number, z: number): V3 => {
  let forward = atomViewerForward.deref();
  let upward = atomViewerUpward.deref();
  let rightward = vCross(upward, forward);
  return vAdd(vAdd(vScale(rightward, -x), vScale(upward, y)), vScale(forward, -z));
};

export let transform3d = (p0: V3): V3 => {
  let point = vSub(p0, atomViewerPosition.deref());
  let lookDistance = newLookatPoint();
  let upward = atomViewerUpward.deref();
  let rightward = vCross(upward, atomViewerForward.deref());
  let s = coneBackScale;
  let r = vDot(point, lookDistance) / vSquare(lookDistance);
  let screenScale = (s + 1) / (r + s);
  let yp = vDot(point, upward) * screenScale;
  let xp = -vDot(point, rightward) * screenScale;
  let zp = r;
  let scale = atomViewerScale.deref();

  return [xp * scale, yp * scale, zp * scale];
};

let vSquare = (v: V3): number => {
  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
};
