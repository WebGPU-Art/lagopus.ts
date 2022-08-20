import { atomDepthTexture, atomContext, atomDevice } from "./global.mjs";

export const initializeContext = async (): Promise<any> => {
  // ~~ INITIALIZE ~~ Make sure we can initialize WebGPU
  if (!navigator.gpu) {
    console.error("WebGPU cannot be initialized - navigator.gpu not found");
    return null;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("WebGPU cannot be initialized - Adapter not found");
    return null;
  }
  const device = await adapter.requestDevice();
  device.lost.then(() => {
    console.error("WebGPU cannot be initialized - Device has been lost");
    return null;
  });

  // set as a shared device
  atomDevice.reset(device);

  const canvas = document.getElementById("canvas-container") as HTMLCanvasElement;
  const context = canvas.getContext("webgpu");
  if (!context) {
    console.error("WebGPU cannot be initialized - Canvas does not support WebGPU");
    return null;
  }

  // ~~ CONFIGURE THE SWAP CHAIN ~~
  const devicePixelRatio = window.devicePixelRatio || 1;
  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();

  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "premultiplied",
  });

  // set as a shared context
  atomContext.reset(context);

  const depthTexture = device.createTexture({
    size: [window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  atomDepthTexture.reset(depthTexture);
};

export let createRenderer = (
  shaderCode: string,
  topology: GPUPrimitiveTopology,
  attrsList: {
    field: string;
    format: GPUVertexFormat;
    size: number;
    /** defaults to 4 for `float32` since 32=8*4, would change for other types */
    unitSize?: number;
  }[],
  data: Record<string, number[]>[]
) => {
  // load shared device
  let device = atomDevice.deref();
  let context = atomContext.deref();
  let depthTexture = atomDepthTexture.deref();

  // extra array, extra cost
  let tmp: number[] = [];
  for (let i = 0; i < data.length; i++) {
    for (let a = 0; a < attrsList.length; a++) {
      tmp.push(...data[i][attrsList[a].field]);
    }
  }
  let vertices = new Float32Array(tmp.length);
  for (let i = 0; i < tmp.length; i++) {
    vertices[i] = tmp[i];
  }

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

  // need to decide `location` based on given information
  let offsetCollect = 0;
  // expected attributes descriptor
  // [
  //   { shaderLocation: 0, offset: 0, format: "float32x4" as GPUVertexFormat },
  //   { shaderLocation: 1, offset: 16, format: "float32x4" as GPUVertexFormat },
  // ];

  const vertexBuffersDescriptors = [
    {
      attributes: attrsList.map((info, idx) => {
        let { format, size } = info;
        let offset = offsetCollect;
        offsetCollect += size * (info.unitSize || 4);
        return { shaderLocation: idx, offset, format };
      }),
      arrayStride: 32,
      stepMode: "vertex" as GPUVertexStepMode,
    },
  ];

  // ~~ DEFINE BASIC SHADERS ~~
  const shaderModule = device.createShaderModule({
    code: shaderCode,
  });

  // ~~ CREATE RENDER PIPELINE ~~
  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: vertexBuffersDescriptors,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology,
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "greater",
      format: "depth24plus",
    },
  });

  // ~~ CREATE RENDER PASS DESCRIPTOR ~~
  const renderPassDescriptor = {
    colorAttachments: [
      {
        // clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: "load" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        view: null as GPUTextureView,
      },
    ],
    depthStencilAttachment: {
      view: null as GPUTextureView,
      depthClearValue: 0.0,
      depthLoadOp: "load" as GPULoadOp,
      depthStoreOp: "store" as GPUStoreOp,
    },
  };

  renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
  renderPassDescriptor.depthStencilAttachment.view = depthTexture.createView();
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(3);
  passEncoder.end();

  return commandEncoder.finish();
};
