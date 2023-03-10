import { Atom } from "./atom.mjs";
import { coneBackScale } from "./config.mjs";
import { atomMouseHoldingPaths, atomObjectsBuffer, atomObjectsTree, atomProxiedDispatch } from "./global.mjs";
import isMobile from "ismobilejs";
import { cDistance } from "./math.mjs";
import { transform3d } from "./perspective.mjs";
import { LagopusElement, LagopusObjectData } from "./primes.mjs";

export let traverseTree = (tree: LagopusElement, coord: number[], cb: (obj: LagopusObjectData, coord: number[]) => void) => {
  if (tree != null) {
    switch (tree.type) {
      case "object":
        cb(tree, coord);
        break;
      case "group":
        if (tree.children != null) {
          tree.children.map((child: LagopusElement, idx: number) => {
            traverseTree(child, [...coord, idx], cb);
          });
        }
        break;
      default:
        console.warn(`unknown element type: ${tree}`);
        break;
    }
  }
};
let handleScreenClick = (event: MouseEvent) => {
  let x = event.clientX - window.innerWidth * 0.5;
  let y = -(event.clientY - window.innerHeight * 0.5);
  let scaleRadio = 0.002 * 0.5 * window.innerWidth;
  let touchDeviation = isMobile ? 16 : 4;
  let hitTargetsBuffer = new Atom([]);
  traverseTree(atomObjectsTree.deref(), [], (obj: LagopusObjectData, coord: number[]) => {
    if (obj.hitRegion != null) {
      let region = obj.hitRegion;
      if (region.onHit != null) {
        let onHit = region.onHit;
        let mappedPosition = transform3d(region.position);
        let screenPosition = mappedPosition.map((p: number) => {
          return p * scaleRadio;
        });
        let r = mappedPosition[2];
        let mappedRadius = scaleRadio * region.radius * ((coneBackScale + 1) / (r + coneBackScale));
        let distance = cDistance([screenPosition[0], screenPosition[1]], [x, y]);
        if (distance <= touchDeviation + mappedRadius && r > -0.8 * coneBackScale) {
          hitTargetsBuffer.deref().push([r, onHit, null]);
        }
      }
    }
  });
  if (hitTargetsBuffer.deref().length > 0) {
    let nearest = findNearest(null, null, null, hitTargetsBuffer.deref());
    let onHit = nearest[0];
    onHit(event, atomProxiedDispatch.deref());
  }
};

let handleScreenMousedown = (event: MouseEvent) => {
  let x = event.clientX - 0.5 * window.innerWidth;
  let y = -(event.clientY - 0.5 * window.innerHeight);
  let scaleRadio = 0.002 * 0.5 * window.innerWidth;
  let touchDeviation = isMobile ? 16 : 4;
  let hitTargetsBuffer = new Atom([]);
  traverseTree(atomObjectsTree.deref(), [], (obj: LagopusObjectData, coord: number[]) => {
    if (obj.hitRegion != null) {
      let region = obj.hitRegion;
      if (region.onMousedown != null) {
        let onMousedown = region.onMousedown;
        let mappedPosition = transform3d(region.position);
        let screenPosition = mappedPosition.map((p: number) => {
          return p * scaleRadio;
        });
        let r = mappedPosition[2];
        let mappedRadius = scaleRadio * region.radius * ((coneBackScale + 1) / (r + coneBackScale));
        let distance = cDistance([screenPosition[0], screenPosition[1]], [x, y]);
        if (distance <= touchDeviation + mappedRadius && r > -0.8 * coneBackScale) {
          hitTargetsBuffer.deref().push([r, onMousedown, coord]);
        }
      }
    }
  });
  if (hitTargetsBuffer.deref().length > 0) {
    let nearest = findNearest(null, null, null, hitTargetsBuffer.deref());
    let onMousedown = nearest[0];
    let coord = nearest[1];
    onMousedown(event, atomProxiedDispatch.deref());
    atomMouseHoldingPaths.deref().push(coord);
  }
};

let handleScreenMousemove = (event: MouseEvent) => {
  let paths = atomMouseHoldingPaths.deref();
  if (paths.length > 0) {
    for (let p of paths) {
      let node = loadTreeNode(atomObjectsTree.deref(), p);
      if (node.type === "object") {
        let onMove = node.hitRegion?.onMousemove;
        if (onMove != null) {
          onMove(event, atomProxiedDispatch.deref());
        }
      }
    }
  }
};

let handleScreenMouseup = (event: MouseEvent) => {
  let paths = atomMouseHoldingPaths.deref();
  if (paths.length > 0) {
    for (let p of paths) {
      let node = loadTreeNode(atomObjectsTree.deref(), p);
      if (node.type === "object") {
        let onUp = node.hitRegion?.onMouseup;
        if (onUp != null) {
          onUp(event, atomProxiedDispatch.deref());
        }
      }
    }
    atomMouseHoldingPaths.reset([]);
  }
};

export let setupMouseEvents = (canvas: HTMLCanvasElement) => {
  canvas.onclick = handleScreenClick;
  canvas.onpointerdown = handleScreenMousedown;
  canvas.onpointermove = handleScreenMousemove;
  canvas.onpointerup = handleScreenMouseup;
  canvas.onpointerleave = handleScreenMouseup;
};

let findNearest = (
  r: number,
  prev: (event: MouseEvent, d: any) => void,
  coord: number[],
  xs: [number, (event: MouseEvent, d: any) => void, number[]][]
): [(event: MouseEvent, d: any) => void, number[]] => {
  if (xs.length === 0) {
    if (prev != null) {
      return [prev, coord];
    } else {
      return null;
    }
  }
  let x0 = xs[0];
  let r0 = x0[0];
  let t0 = x0[1];
  let c0 = x0[2];
  if (prev == null) {
    return findNearest(r0, t0, c0, xs.slice(1));
  } else {
    if (r0 < r) {
      return findNearest(r0, t0, c0, xs.slice(1));
    } else {
      return findNearest(r, prev, coord, xs.slice(1));
    }
  }
};

let loadTreeNode = (tree: LagopusElement, path: number[]): LagopusElement => {
  if (path.length === 0) {
    return tree;
  } else if (tree.type === "group") {
    let children = tree.children;
    return loadTreeNode(children[path[0]], path.slice(1));
  } else {
    console.error("loadTreeNode: invalid tree", tree);
    throw new Error("Unexpected tree node");
  }
};
