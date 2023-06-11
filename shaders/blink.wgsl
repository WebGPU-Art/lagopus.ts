struct UBO {
  cone_back_scale: f32,
  viewport_ratio: f32,
  look_distance: f32,
  scale: f32,
  forward: vec3f,
  // direction up overhead, better unit vector
  upward: vec3f,
  rightward: vec3f,

  camera_position: vec3f,
  _pad: u32, // https://www.w3.org/TR/WGSL/#structure-member-layout

  // custom data
  time: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: UBO;

// perspective

struct PointResult {
  point_position: vec3f,
  r: f32,
  s: f32,
};

fn transform_perspective(p: vec3f) -> PointResult {
  let forward = uniforms.forward;
  let upward = uniforms.upward;
  let rightward = uniforms.rightward;
  let look_distance = uniforms.look_distance;
  let camera_position = uniforms.camera_position;

  let moved_point: vec3f = p - camera_position;

  let s: f32 = uniforms.cone_back_scale;

  let r: f32 = dot(moved_point, forward) / look_distance;

  // if (r < (s * -0.9)) {
  //   // make it disappear with depth test since it's probably behind the camera
  //   return PointResult(vec3(0.0, 0.0, 10000.), r, s);
  // }

  let screen_scale: f32 = (s + 1.0) / (r + s);
  let y_next: f32 = dot(moved_point, upward) * screen_scale;
  let x_next: f32 = dot(moved_point, rightward) * screen_scale;
  let z_next: f32 = r;

  return PointResult(
    vec3(x_next, y_next / uniforms.viewport_ratio, z_next) * uniforms.scale,
    r, s
  );
}

// main

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(1) time: f32,
};

@vertex
fn vertex_main(
  @location(0) position: vec4f,
) -> VertexOut {
  let p = transform_perspective(position.xyz).point_position;

  var output: VertexOut;
  output.position = vec4((p * 0.002).xyz, 1.0);
  // output.position = position;
  output.time = fract(uniforms.time);
  // output.time = 0.5;
  return output;
}

@fragment
fn fragment_main(vtx_out: VertexOut) -> @location(0) vec4f {
  // return vtx_out.color;
  let unit = vec3f(1.0, 1.0, 1.0);
  return vec4f(unit * vtx_out.time, 1.0);
}
