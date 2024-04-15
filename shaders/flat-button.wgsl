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
};

struct Params {
  size: f32,
  p1: f32,
  p2: f32,
  p3: f32
}

@group(0) @binding(0) var<uniform> uniforms: UBO;
@group(0) @binding(1) var<uniform> params: Params;

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
  @location(1) offset: f32,
};

@vertex
fn vertex_main(
  @location(0) position: vec4f,
  @location(1) color: vec4f
) -> VertexOut {
  var output: VertexOut;
  var point_position = position.xyz;
  let radius: f32 = 1. * params.size;
  let right = uniforms.rightward;
  let up = uniforms.upward;
  var offset = 1.;

    // hexagon
  let index = u32(position.w);
  if index == 0u {
    offset = 0.;
  } else if index == 1u {
    point_position += radius * (1. * right + 0. * up);
  } else if index == 2u {
    point_position += radius * (0.5 * right + 0.866 * up);
  } else if index == 3u {
    point_position += radius * (-0.5 * right + 0.866 * up);
  } else if index == 4u {
    point_position += radius * (-1. * right + 0. * up);
  } else if index == 5u {
    point_position += radius * (-0.5 * right + -0.866 * up);
  } else if index == 6u {
    point_position += radius * (0.5 * right + -0.866 * up);
  }
  let p = transform_perspective(point_position).point_position;

  let scale: f32 = 0.002;
  output.position = vec4(p[0] * scale, p[1] * scale, p[2] * scale, 1.0);
  output.offset = offset;

  // output.position = position;
  output.color = color;
  return output;
}

@fragment
fn fragment_main(vtx_out: VertexOut) -> @location(0) vec4f {
  if vtx_out.offset >= 0.98 {
    return vec4(.9, 0.8, 0., 1.0);
  }
  if vtx_out.offset >= 0.9 {
    return vec4(.0, 0.0, 0.7, 1.0);
  }

  return vtx_out.color;
}
