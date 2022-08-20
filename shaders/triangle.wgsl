struct UBO {
  modelViewProj: mat4x4<f32>,
  primaryColor: vec4<f32>,
  accentColor: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> uniforms: UBO;

struct VertexOut {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

@vertex
fn vertex_main(
    @location(0) position: vec4<f32>,
    @location(1) color: vec4<f32>
) -> VertexOut
{
    var output: VertexOut;
    output.position = position;
    output.color = uniforms.primaryColor;
    return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
    return fragData.color;
    // return vec4<f32>(0.0, 0.0, 1.0, 1.0);
}
