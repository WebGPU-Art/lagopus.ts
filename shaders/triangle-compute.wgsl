struct UBO {
  cone_back_scale: f32,
  viewport_ratio: f32,
  look_distance: f32,
  scale: f32,
  forward: vec3f,
  // Upward direction unit vector for camera orientation
  upward: vec3f,
  rightward: vec3f,
  camera_position: vec3f,
};

struct Params {
  _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: UBO;
@group(0) @binding(1) var<uniform> params: Params;

struct ParticleInfo {
  position: vec3f,
  velocity: vec3f,
}

struct Particles {
  particles: array<ParticleInfo>,
};

@group(1) @binding(0) var<storage, read> input: Particles;
@group(1) @binding(1) var<storage, read_write> output: Particles;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
  var index = GlobalInvocationID.x;
  if index < arrayLength(&input.particles) {
    let input_item = input.particles[index];
    output.particles[index].position = input_item.position + 0.2 * input_item.velocity;
  }
}

// perspective

struct PointResult {
  pointPosition: vec3f,
  r: f32,
  s: f32,
};

fn transform_perspective(p: vec3f) -> PointResult {
  let forward = uniforms.forward;
  let upward = uniforms.upward;
  let rightward = uniforms.rightward;
  let look_distance = uniforms.look_distance;
  let camera_position = uniforms.camera_position;

  let moved_point: vec3f = (p - camera_position);

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
  @location(0) color: vec4f,
};

@vertex
fn vertex_main(
  @location(0) position: vec4f,
  @location(1) color: vec4f,
  @location(2) pointer: u32,
) -> VertexOut {

  let base = input.particles[pointer].position;

  let p = transform_perspective(position.xyz + base).pointPosition;
  let scale: f32 = 0.002;
  var output: VertexOut = VertexOut(
    vec4(p.xyz * scale, 1.0),
    color
  );
  return output;
}

@fragment
fn fragment_main(vtx_out: VertexOut) -> @location(0) vec4f {
  return vtx_out.color;
}
