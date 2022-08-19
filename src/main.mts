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

  let createRenderer = (vertices: Float32Array) => {
    const vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();

    const vertexBuffersDescriptors = [
      {
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x4" as const,
          },
          {
            shaderLocation: 1,
            offset: 16,
            format: "float32x4" as const,
          },
        ],
        arrayStride: 32,
        stepMode: "vertex" as const,
      },
    ];

    // ~~ DEFINE BASIC SHADERS ~~
    const shaderModule = device.createShaderModule({
      code: triangleWgsl,
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
        topology: "triangle-list",
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
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "load" as const,
          storeOp: "store" as const,
          view: null as GPUTextureView,
        },
      ],
      depthStencilAttachment: {
        view: null as GPUTextureView,
        depthClearValue: 0.0,
        depthLoadOp: "load" as const,
        depthStoreOp: "store" as const,
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
    // next

    // ~~ SETUP VERTICES (position (vec3<f32>), color(vec4<i32>)) ~~
    // Pack them all into one array
    // Each vertex has a position and a color packed in memory in X Y Z W R G B A order
    const vertices = new Float32Array([
      // p0
      -1.0, -1.0, 0.3, 1, 1, 0, 0, 1,
      // p1
      -0.0, 1.0, 0.3, 1, 0, 1, 0, 1,
      // p2
      1.0, -1.0, 0.3, 1, 0, 0, 1, 1,
    ]);

    let commandBuffer = createRenderer(vertices);

    const vertices2 = new Float32Array([
      // p0
      -1.0, 1.0, 0.4, 1, 1, 0, 0, 1,
      // p1
      -0.0, -1.0, 0.4, 1, 0, 1, 0, 1,
      // p2
      1.0, 1.0, 0.4, 1, 0, 0, 1, 1,
    ]);

    let commandBuffer2 = createRenderer(vertices2);

    device.queue.submit([commandBuffer, commandBuffer2]);

    // requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};

init();
console.log("loaded");
