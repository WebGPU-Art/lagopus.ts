import { object } from "../alias.mjs";
import { vAdd, vCross, vDot, vScale, vSub } from "@triadica/touch-control";

import { Atom } from "@triadica/touch-control";
import { FnDispatch, V3, V2, LagopusRenderObject } from "../primes.mjs";

let atomDragCache = new Atom<{ x: number; y: number }>({
  x: 0,
  y: 0,
});

import triangleWgsl from "../../shaders/triangle.wgsl";
import flatButtonWgsl from "../../shaders/flat-button.wgsl";
import { atomViewerForward, atomViewerPosition, atomViewerUpward, newLookatPoint, atomViewerScale } from "../perspective.mjs";
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
): LagopusRenderObject => {
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
    label: "slider",
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
      { field: "position", format: "float32x4" },
      { field: "color", format: "float32x4" },
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
): LagopusRenderObject => {
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
    onMove(vAdd(position, vScale(vAdd(vScale(rightward, dx), vScale(upward, dy)), calculateDragScale(position, lookDistance, coneBackScale))), d);
  };
  return object({
    label: "drag-point",
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
      { field: "position", format: "float32x4" },
      { field: "color", format: "float32x4" },
    ],
    data: indices.map((i) => ({
      position: [...vAdd(geo[i].map((x) => x * size) as V3, position), 1.0],
      color,
    })),
  });
};

function calculateDragScale(position: V3, lookDistance: V3, s: number): number {
  const r =
    vDot(vSub(position, atomViewerPosition.deref()), lookDistance) /
    (Math.pow(lookDistance[0], 2) + Math.pow(lookDistance[1], 2) + Math.pow(lookDistance[2], 2));
  const scaleRadio = window.innerWidth * 0.002 * 0.5;
  const screenScale = (r + s) / (s + 1);
  return (screenScale / scaleRadio) * (1 / atomViewerScale.deref());
}

export let compButton = (
  props: {
    position: V3;
    size?: number;
    color?: V3;
  },
  onClick: (e: MouseEvent, d: FnDispatch) => void
): LagopusRenderObject => {
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
    label: "button",
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
      { field: "position", format: "float32x4" },
      { field: "color", format: "float32x4" },
    ],
    data: indices.map((i) => ({
      position: [...vAdd(geo[i].map((x) => x * size) as V3, position), 1.0],
      color,
    })),
  });
};

export let compFlatButton = (
  props: {
    position: V3;
    size?: number;
    color?: V3;
  },
  onClick: (e: MouseEvent, d: FnDispatch) => void
): LagopusRenderObject => {
  let position = props.position;
  let size = props.size ?? 20;
  let color = props.color ?? [0.6, 1, 0.56, 1.0];
  let indices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 1];
  return object({
    label: "flat-button",
    topology: "triangle-list",
    shader: flatButtonWgsl,
    hitRegion: {
      position,
      radius: size,
      onHit: (e: MouseEvent, d: FnDispatch) => {
        onClick(e, d);
      },
    },
    attrsList: [
      { field: "position", format: "float32x4" },
      { field: "color", format: "float32x4" },
    ],
    data: indices.map((i) => ({
      position: [...position, i],
      color,
    })),
    getParams: () => [props.size, 0, 0, 0],
  });
};
