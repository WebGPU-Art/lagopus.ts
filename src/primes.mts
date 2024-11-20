/** a simpler type for Dispatch */
export type FnDispatch = (op: string, data: any) => void;

/** 3D point */
export type V3 = [number, number, number];

/** 2D point */
export type V2 = [number, number];

export interface LagopusAttribute {
  field: string;
  /** Lagopus has only very limited support for f32 and u32 */
  format: GPUVertexFormat;
}

export interface ComputeOptions {
  particleCount: number;
  initialBuffer: Float32Array;
}

export interface LagopusObjectOptions {
  label?: string;
  shader: string;
  topology: GPUPrimitiveTopology;
  attrsList: LagopusAttribute[];
  data: Record<string, number | number[]>[];
  hitRegion?: LagopusHitRegion;
  indices?: number[];
  getParams?: () => number[];
  textures?: GPUTexture[];
  computeOptions?: ComputeOptions;
}

export interface LagopusObjectData {
  type: "object";
  topology: GPUPrimitiveTopology;
  vertexBuffersDescriptors: Iterable<GPUVertexBufferLayout | null>;
  shaderModule: GPUShaderModule;
  vertexBuffers: GPUBuffer[];
  verticesLength: number;
  hitRegion?: LagopusHitRegion;
  indices?: GPUBuffer;
  indicesCount?: number;
  getParams?: () => number[];
  textures?: GPUTexture[];
  label: string;
  computeOptions?: ComputeOptions;
}

export interface LagopusRenderObject {
  type: "object" | "group";
  renderer?: (t: number, c: GPUCommandEncoder) => void;
  children?: LagopusRenderObject[];
  hitRegion?: LagopusHitRegion;
}

export interface LagopusGroup {
  type: "group";
  children: LagopusElement[];
}

export type LagopusElement = LagopusGroup | LagopusObjectData;

/** hitRegion information for object element */
export interface LagopusHitRegion {
  radius: number;
  position: V3;
  onHit?: (e: MouseEvent, d: (op: string, data: any) => void) => void;
  onMousedown?: (e: MouseEvent, d: (op: string, data: any) => void) => void;
  onMousemove?: (e: MouseEvent, d: (op: string, data: any) => void) => void;
  onMouseup?: (e: MouseEvent, d: (op: string, data: any) => void) => void;
}

export interface LagopusObjectBuffer {
  hitRegion?: LagopusHitRegion;
}
