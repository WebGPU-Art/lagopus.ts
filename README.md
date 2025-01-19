## WebGPU tiny example

Based on:

- https://medium.com/@carmencincotti/drawing-a-triangle-with-webgpu-53d48fb1ba8
- https://codepen.io/alaingalvan/pen/GRgvLGw

> WebGPU support has landed on latest Chrome.

### Usage

> Read full example in https://github.com/WebGPU-Art/lagopus-ts-workflow .

Defining object:

```js
object({
  shader: triangleWgsl,
  topology: "triangle-list",
  attrsList: [
    { field: "position", format: "float32x4" },
    { field: "color", format: "float32x4" },
  ],
  // vertex params
  data: [
    { position: [120.0, 120.0, 30, 1], color: [1, 0, 0, 1] },
    { position: [128.0, 120.0, 30, 1], color: [1, 0, 0, 1] },
    { position: [120.0, 126.0, 38, 1], color: [1, 0, 0, 1] },
  ],
  hitRegion: {
    radius: 4,
    position: [124, 123, 34],
    onHit: (e, d) => {
      console.log("hit", e);
      d("hit", { x: e.clientX, y: e.clientY });
    },
  },
  // in @group(0) for uniforms
  getParams: () => {
    return [(Date.now() / 400) % 1, 0, 0, 0];
  },
  // in @group(1) for textures
  textures: [],
});
```

Shader:

```wgsl
struct UBO {
  cone_back_scale: f32,
  viewport_ratio: f32,
  look_distance: f32,
  forward: vec3f,
  // direction up overhead, better unit vector
  upward: vec3f,
  rightward: vec3f,
  camera_position: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: UBO;

// your custom params
struct Params {
  _pad: f32
}

@group(0) @binding(1) var<uniform> params Params;

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
    vec3(x_next, y_next / uniforms.viewport_ratio, z_next),
    r, s
  );
}

// main

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
};

@vertex
fn vertex_main(
  @location(0) position: vec4f,
  @location(1) color: vec4f
) -> VertexOut {
  var output: VertexOut;
  let p = transform_perspective(position.xyz).pointPosition;
  let scale: f32 = 0.002;
  output.position = vec4(p[0]*scale, p[1]*scale, p[2]*scale, 1.0);
  // output.position = position;
  output.color = color;
  return output;
}

@fragment
fn fragment_main(vtx_out: VertexOut) -> @location(0) vec4f {
  return vtx_out.color;
  // return vec4f(0.0, 0.0, 1.0, 1.0);
}
```

Uniforms is passed from `params`, [whose layout is quite tricky](https://www.w3.org/TR/WGSL/#structure-member-layout).

### License

MIT
