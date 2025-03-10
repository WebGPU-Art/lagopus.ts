import { ComputeOptions, LagopusAttribute, LagopusHitRegion, LagopusRenderObject } from "./primes.mjs";

import { createBuffer, readFormatSize } from "./util.mjs";
import { atomDevice, atomProxiedDispatch, atomLagopusTree } from "./global.mjs";
import { makePainter } from "./paint.mjs";

/** prepare vertex buffer from object */
export let createRenderer = (options: {
  shader: string;
  topology: GPUPrimitiveTopology;
  attrsList: LagopusAttribute[];
  verticesLength: number;
  vertices: (Float32Array | Uint32Array)[];
  hitRegion: LagopusHitRegion;
  indices: Uint32Array;
  getParams: () => number[];
  textures: GPUTexture[];
  label: string;
  computeOptions?: ComputeOptions;
}): LagopusRenderObject => {
  // load shared device
  let device = atomDevice.deref();

  let vertexBuffers = options.vertices.map((v) => createBuffer(v, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, "vertex"));
  let indicesBuffer = options.indices ? createBuffer(options.indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, "index") : null;

  const vertexBuffersDescriptors = options.attrsList.map((info, idx) => {
    let stride = readFormatSize(info.format);
    return {
      attributes: [{ shaderLocation: idx, offset: 0, format: info.format }],
      arrayStride: stride,
      stepMode: "vertex" as GPUVertexStepMode,
    } as GPUVertexBufferLayout;
  });

  // ~~ DEFINE BASIC SHADERS ~~
  const shaderModule = device.createShaderModule({
    label: options.label,
    code: options.shader,
  });

  shaderModule.getCompilationInfo().then((e) => {
    // a dirty hook to expose build messages
    globalThis.__lagopusHandleCompilationInfo?.(e, options.shader);
  });

  return {
    type: "object",
    hitRegion: options.hitRegion,
    renderer: makePainter({
      type: "object",
      topology: options.topology,
      shaderModule: shaderModule,
      vertexBuffersDescriptors,
      vertexBuffers,
      verticesLength: options.verticesLength,
      hitRegion: options.hitRegion,
      indices: indicesBuffer,
      indicesCount: options.indices ? options.indices.length : 0,
      getParams: options.getParams,
      textures: options.textures,
      label: options.label,
      computeOptions: options.computeOptions,
    }),
  };
};

/** track tree, internally it calls `paintLagopusTree` to render */
export function renderLagopusTree(tree: LagopusRenderObject, dispatch: (op: any, data: any) => void) {
  atomProxiedDispatch.reset(dispatch);
  atomLagopusTree.reset(tree);
}

export function resetCanvasSize(canvas: HTMLCanvasElement) {
  // canvas height not accurate on Android Pad, use innerHeight
  canvas.style.height = `${window.innerHeight}px`;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.width = window.innerWidth * devicePixelRatio;
}
