import { LagopusElement, LagopusObjectBuffer } from "./primes.mjs";
import { Atom } from "./atom.mjs";

export var atomDevice: Atom<GPUDevice> = new Atom(null);
export var atomContext: Atom<GPUCanvasContext> = new Atom(null);

/** TODO depth texture is shared by now, not sure which is better */
export var atomDepthTexture: Atom<GPUTexture> = new Atom(null);
/** as the fake canvas */
export let atomCanvasTexture = new Atom(undefined as GPUTexture);
export let atomFilterTexture = new Atom(undefined as GPUTexture);

/** ping/pong buffer for bloom effect */
export let atomPingBuffer = new Atom(undefined as GPUBuffer);
export let atomPongBuffer = new Atom(undefined as GPUBuffer);
export let atomScreenFilterBuffer = new Atom(undefined as GPUBuffer);

export var atomBufferNeedClear: Atom<boolean> = new Atom(true);

export var atomClearColor: Atom<{ r: number; g: number; b: number; a: number }> = new Atom(undefined);

export var atomLagopusTree: Atom<LagopusElement> = new Atom(null);

// proxy it for hot reloading
export let atomProxiedDispatch = new Atom<(op: string, data: any) => void>(null);

// touch events

export var atomMouseHoldingPaths = new Atom<number[][]>([]);

export let atomObjectsTree = new Atom<LagopusElement>(null);

export let atomObjectsBuffer = new Atom<LagopusObjectBuffer[]>([]);

export let atomCommandEncoder = new Atom<GPUCommandEncoder>(null);

export function wLog<T extends any>(message: string, a: T): T {
  console.warn(message, a);
  return a;
}
