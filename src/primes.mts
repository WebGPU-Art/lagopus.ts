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
}

export interface LagopusObjectData {
  type: "object";
  buffer: GPUCommandBuffer;
}

export interface LagopusGroup {
  type: "group";
  children: LagopusElement[];
}

export type LagopusElement = LagopusGroup | LagopusObjectData;
