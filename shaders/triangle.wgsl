struct UBO {
  coneBackScale: f32,
  viewportRatio: f32,
  lookPoint: vec3<f32>,
  // direction up overhead, better unit vector
  upwardDirection: vec3<f32>,
  cameraPosition: vec3<f32>,
};

@group(0) @binding(0)
var<uniform> uniforms: UBO;

// perspective

struct PointResult {
  pointPosition: vec3<f32>,
  r: f32,
  s: f32,
};

fn transform_perspective(p: vec3<f32>) -> PointResult {
  let lookPoint = uniforms.lookPoint;
  let upwardDirection = uniforms.upwardDirection;
  let cameraPosition = uniforms.cameraPosition;

  let moved_point: vec3<f32> = p - cameraPosition;
  // trying to get right direction at length 1
  let rightward: vec3<f32> = cross(upwardDirection, lookPoint) / 600.0;

  let s: f32 = uniforms.coneBackScale;

  let square_length: f32 = lookPoint.x*lookPoint.x + lookPoint.y*lookPoint.y + lookPoint.z*lookPoint.z;
  let r: f32 = dot(moved_point, lookPoint) / square_length;

  // if (r < (s * -0.9)) {
  //   // make it disappear with depth test since it's probably behind the camera
  //   return PointResult(vec3(0.0, 0.0, 10000.), r, s);
  // }

  let screen_scale: f32 = (s + 1.0) / (r + s);
  let y_next: f32 = dot(moved_point, upwardDirection) * screen_scale;
  let x_next: f32 = - dot(moved_point, rightward) * screen_scale;
  let z_next: f32 = r;

  return PointResult(
    vec3(x_next, y_next / uniforms.viewportRatio, z_next),
    r, s
  );
}

// main

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
  let p = transform_perspective(position.xyz).pointPosition;
  let scale: f32 = 0.002;
  output.position = vec4(p[0]*scale, p[1]*scale, p[2]*scale, 1.0);
  // output.position = position;
  output.color = color;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
    return fragData.color;
    // return vec4<f32>(0.0, 0.0, 1.0, 1.0);
}
