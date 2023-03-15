/** a simpler type for Dispatch */
export type FnDispatch = (op: string, data: any) => void;

/** 3D point */
export type V3 = [number, number, number];

/** 2D point */
export type V2 = [number, number];

export interface LagopusAttribute {
  field: string;
  format: GPUVertexFormat;
  size: number;
  /** defaults to 4 for `float32` since 32=8*4, would change for other types */
  unitSize?: number;
}

export interface LagopusObjectOptions {
  shader: string;
  topology: GPUPrimitiveTopology;
  attrsList: LagopusAttribute[];
  data: Record<string, number[]>[];
  hitRegion?: LagopusHitRegion;
  indices?: number[];
}

export interface LagopusObjectData {
  type: "object";
  topology: GPUPrimitiveTopology;
  vertexBuffersDescriptors: Iterable<GPUVertexBufferLayout | null>;
  shaderModule: GPUShaderModule;
  vertexBuffers: GPUBuffer[];
  length: number;
  hitRegion?: LagopusHitRegion;
  indices?: GPUBuffer;
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
