import { Atom } from "./atom.mjs";

export var atomDevice: Atom<GPUDevice> = new Atom(null);
export var atomContext: Atom<GPUCanvasContext> = new Atom(null);
/** TODO depth texture is shared by now, not sure which is better */
export var atomDepthTexture: Atom<GPUTexture> = new Atom(null);
