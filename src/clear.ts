import { atomClearColor, atomContext, atomDevice } from "./global.mjs";

/** renders on lya single point, which consists no triangle */
let triangleWgsl = `
@vertex
fn main_vertex(
  @builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2(0, 0),
    vec2(0, 0),
    vec2(0, 0)
  );
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn main_frag() -> @location(0) vec4<f32> {
  return vec4(1.0, 0.0, 0.0, 1.0);
}
`;

/** when no command is emitted in a render pass, we need to clear canvas since nothing is re-draw.
 * used in hot swapping.
 */
export let clearCanvas = (commandEncoder: GPUCommandEncoder) => {
  let device = atomDevice.deref();
  let context = atomContext.deref();
  const presentationFormat = window.navigator.gpu.getPreferredCanvasFormat();

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: triangleWgsl,
      }),
      entryPoint: "main_vertex",
    },
    fragment: {
      module: device.createShaderModule({
        code: triangleWgsl,
      }),
      entryPoint: "main_frag",
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: atomClearColor.deref() ?? { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.draw(3);
  passEncoder.end();
};
