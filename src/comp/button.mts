import { object } from "../alias.mjs";
import { vAdd, vCross, vDot, vScale, vSub } from "../quaternion.mjs";

import { Atom } from "../atom.mjs";
import { FnDispatch, V3, V2, LagopusObjectData } from "../primes.mjs";

let atomDragCache = new Atom<{ x: number; y: number }>({
  x: 0,
  y: 0,
});

import triangleWgsl from "../../shaders/triangle.wgsl";
import { atomViewerForward, atomViewerPosition, atomViewerUpward, newLookatPoint } from "../perspective.mjs";
import { coneBackScale } from "../config.mjs";
import { wLog } from "../global.mjs";

/** drag slider component for controlling 1 or 2 values */
export let compSlider = (
  props: {
    position: V3;
    size?: number;
    color?: V3;
  },
  onMove: (delta: V2, dispatch: FnDispatch) => void
): LagopusObjectData => {
  let { position } = props;
  let geo: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  let size = props.size ?? 20;
  let color = props.color ?? [0.6, 1, 0.56, 1.0];
  let indices = [0, 5, 2, 1, 4, 2, 1, 5, 3, 0, 4, 3];
  let handleDrag = (x: number, y: number, d: FnDispatch) => {
    let prev = atomDragCache.deref();
    let dx = x - prev.x;
    let dy = prev.y - y;
    onMove([dx, dy], d);
  };
  return object({
    topology: "triangle-list",
    shader: triangleWgsl,
    hitRegion: {
      position,
      radius: 20,
      onMousedown: (e: MouseEvent, d: FnDispatch) => {
        let x = e.clientX;
        let y = e.clientY;
        atomDragCache.reset({ x, y });
      },
      onMousemove: (e: MouseEvent, d: FnDispatch) => {
        let x = e.clientX;
        let y = e.clientY;
        handleDrag(x, y, d);
        atomDragCache.reset({ x, y });
      },
      onMouseup: (e: MouseEvent, d: FnDispatch) => {
        let x = e.clientX;
        let y = e.clientY;
        handleDrag(x, y, d);
      },
    },
    attrsList: [
      { field: "position", format: "float32x4", size: 4 },
      { field: "color", format: "float32x4", size: 4 },
    ],
    data: indices.map((i) => ({
      position: [...vAdd(geo[i].map((x) => x * size) as V3, position), 1.0],
      color,
    })),
  });
};

export let compDragPoint = (
  props: {
    position: V3;
    ignoreMoving?: boolean;
    size?: number;
    color?: V3;
  },
  onMove: (p: V3, d: FnDispatch) => void
): LagopusObjectData => {
  let position = props.position;
  let ignoreMoving = props.ignoreMoving ?? false;
  let geo: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  let size = props.size ?? 20;
  let color = props.color ?? [0.6, 1, 0.56, 1.0];
  let indices = [0, 5, 2, 1, 4, 2, 1, 5, 3, 0, 4, 3];
  let handleDrag = (x: number, y: number, d: FnDispatch) => {
    let prev = atomDragCache.deref();
    let dx = x - prev.x;
    let dy = prev.y - y;
    let lookDistance = newLookatPoint();
    let upward = atomViewerUpward.deref();
    let rightward = vScale(vCross(upward, atomViewerForward.deref()), -1);
    let s = coneBackScale;
    let r =
      vDot(vSub(position, atomViewerPosition.deref()), lookDistance) /
      (Math.pow(lookDistance[0], 2) + Math.pow(lookDistance[1], 2) + Math.pow(lookDistance[2], 2));
    let scaleRadio = window.innerWidth * 0.002 * 0.5;
    let screenScale = (r + s) / (s + 1);
    onMove(vAdd(position, vScale(vAdd(vScale(rightward, dx), vScale(upward, dy)), screenScale / scaleRadio)), d);
  };
  return object({
    topology: "triangle-list",
    shader: triangleWgsl,
    hitRegion: {
      position,
      radius: size,
      onMousedown: (e: MouseEvent, d: FnDispatch) => {
        let x = e.clientX;
        let y = e.clientY;
        atomDragCache.reset({ x, y });
      },
      onMousemove: ignoreMoving
        ? undefined
        : (e: MouseEvent, d: FnDispatch) => {
            let x = e.clientX;
            let y = e.clientY;
            handleDrag(x, y, d);
            atomDragCache.reset({ x, y });
          },
      onMouseup(e, d) {
        let x = e.clientX;
        let y = e.clientY;
        handleDrag(x, y, d);
      },
    },
    attrsList: [
      { field: "position", format: "float32x4", size: 4 },
      { field: "color", format: "float32x4", size: 4 },
    ],
    data: indices.map((i) => ({
      position: [...vAdd(geo[i].map((x) => x * size) as V3, position), 1.0],
      color,
    })),
  });
};

export let compButton = (
  props: {
    position: V3;
    size?: number;
    color?: V3;
  },
  onClick: (e: MouseEvent, d: FnDispatch) => void
): LagopusObjectData => {
  let position = props.position;
  let size = props.size ?? 20;
  let color = props.color ?? [0.6, 1, 0.56, 1.0];
  let geo: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  let indices = [0, 5, 2, 1, 4, 2, 1, 5, 3, 0, 4, 3];
  return object({
    topology: "triangle-list",
    shader: triangleWgsl,
    hitRegion: {
      position,
      radius: size,
      onHit: (e: MouseEvent, d: FnDispatch) => {
        onClick(e, d);
      },
    },
    attrsList: [
      { field: "position", format: "float32x4", size: 4 },
      { field: "color", format: "float32x4", size: 4 },
    ],
    data: indices.map((i) => ({
      position: [...vAdd(geo[i].map((x) => x * size) as V3, position), 1.0],
      color,
    })),
  });
};
