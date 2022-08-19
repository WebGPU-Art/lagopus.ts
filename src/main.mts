import triangleWgsl from "../shaders/triangle.wgsl";

const init = async (): Promise<any> => {
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

  const depthTexture = device.createTexture({
    size: [window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  let createRenderer = (
    shaderCode: string,
    topology: GPUPrimitiveTopology,
    attrsList: {
      field: string;
      format: GPUVertexFormat;
      size: number;
    }[],
    data: Record<string, number[]>[]
  ) => {
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
          offsetCollect += size * 4;
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

  // ~~ Define render loop ~~
  function frame() {
    // ~~ SETUP VERTICES (position (vec3<f32>), color(vec4<i32>)) ~~
    // Pack them all into one array
    // Each vertex has a position and a color packed in memory in X Y Z W R G B A order

    let commandBuffer = createRenderer(
      triangleWgsl,
      "triangle-list",
      [
        { field: "position", format: "float32x4", size: 4 },
        { field: "color", format: "float32x4", size: 4 },
      ],
      [
        { position: [-1.0, -1.0, 0.3, 1], color: [1, 0, 0, 1] },
        { position: [-0.0, 1.0, 0.3, 1], color: [1, 1, 0, 1] },
        { position: [1.0, -1.0, 0.3, 1], color: [0, 0, 1, 1] },
      ]
    );

    let commandBuffer2 = createRenderer(
      triangleWgsl,
      "triangle-list",
      [
        { field: "position", format: "float32x4", size: 4 },
        { field: "color", format: "float32x4", size: 4 },
      ],
      [
        { position: [-1.0, 1.0, 0.4, 1], color: [1, 0, 0, 1] },
        { position: [-0.0, -1.0, 0.4, 1], color: [1, 1, 0, 1] },
        { position: [1.0, 1.0, 0.4, 1], color: [0, 0, 1, 1] },
      ]
    );

    device.queue.submit([commandBuffer, commandBuffer2]);

    // requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};

init();
console.log("loaded");
