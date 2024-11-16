import { ComputeOptions, LagopusAttribute, LagopusElement, LagopusHitRegion, LagopusObjectData } from "./primes.mjs";

import { createBuffer, readFormatSize } from "./util.mjs";
import { atomDevice, atomLagopusTree, atomProxiedDispatch, atomObjectsTree } from "./global.mjs";
import { paintLagopusTree } from "./paint.mjs";

/** prepare vertex buffer from object */
export let createRenderer = (
  shaderCode: string,
  topology: GPUPrimitiveTopology,
  attrsList: LagopusAttribute[],
  verticesLength: number,
  vertices: (Float32Array | Uint32Array)[],
  hitRegion: LagopusHitRegion,
  indices: Uint32Array,
  getParams: () => number[],
  textures: GPUTexture[],
  label: string,
  computeOptions?: ComputeOptions
): LagopusObjectData => {
  // load shared device
  let device = atomDevice.deref();

  let vertexBuffers = vertices.map((v) => createBuffer(v, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, "vertex"));
  let indicesBuffer = indices ? createBuffer(indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, "index") : null;

  const vertexBuffersDescriptors = attrsList.map((info, idx) => {
    let stride = readFormatSize(info.format);
    return {
      attributes: [{ shaderLocation: idx, offset: 0, format: info.format }],
      arrayStride: stride,
      stepMode: "vertex" as GPUVertexStepMode,
    } as GPUVertexBufferLayout;
  });

  // ~~ DEFINE BASIC SHADERS ~~
  const shaderModule = device.createShaderModule({
    label,
    code: shaderCode,
  });

  shaderModule.getCompilationInfo().then((e) => {
    // a dirty hook to expose build messages
    globalThis.__lagopusHandleCompilationInfo?.(e, shaderCode);
  });

  return {
    type: "object",
    topology: topology,
    shaderModule: shaderModule,
    vertexBuffersDescriptors: vertexBuffersDescriptors,
    vertexBuffers,
    length: verticesLength,
    hitRegion: hitRegion,
    indices: indicesBuffer,
    getParams,
    textures,
    label,
    computeOptions,
  };
};

/** track tree, internally it calls `paintLagopusTree` to render */
export function renderLagopusTree(tree: LagopusElement, dispatch: (op: any, data: any) => void) {
  atomLagopusTree.reset(tree);
  atomProxiedDispatch.reset(dispatch);
  atomObjectsTree.reset(tree);
  paintLagopusTree();
}

export function resetCanvasSize(canvas: HTMLCanvasElement) {
  // canvas height not accurate on Android Pad, use innerHeight
  canvas.style.height = `${window.innerHeight}px`;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.width = window.innerWidth * devicePixelRatio;
}
