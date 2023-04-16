//! a shader from WGSL samples to render to canvas
//! https://github.com/webgpu/webgpu-samples/blob/main/src/shaders/fullscreenTexturedQuad.wgsl

@group(0) @binding(0) var mySampler : sampler;
@group(0) @binding(1) var myTexture : texture_2d<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  const pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );

  const uv = array(
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
  );

  var output : VertexOutput;
  output.Position = vec4(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}

@fragment
fn frag_main(@location(0) fragUV : vec2f) -> @location(0) vec4f {
  let a = textureSample(myTexture, mySampler, fragUV);
  let s = color_strength(a);
  if (s > 0.6) {
    return a * s * (s - 0.6) * 4;
  } else {
    // return vec4(0.6, 0.6, 1.0, 1.0);
    return vec4(0, 0, 0.0, 1.0);
  }
}

fn color_strength(color: vec4f) -> f32 {
  return dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
}
