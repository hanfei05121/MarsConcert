/**
 * Silk 丝绸背景着色器。
 *
 * 逐字搬运自 careercompass-main-vue/src/components/canvas/silkShader.ts，
 * 原出处为 ShaderToy https://www.shadertoy.com/view/X3yXRd ：
 *   The MIT License
 *   Copyright © 2024 Giorgi Azmaipharashvili
 *
 * 这里用最小 WebGL2 全屏三角形渲染承载这段 GLSL，无额外依赖。
 */

/** 顶点着色器：覆盖整个屏幕的两个三角形，position 为裁剪空间坐标 */
export const SILK_VERTEX_SHADER = `#version 300 es
#ifdef GL_ES
precision highp float;
precision highp int;
#endif
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

/**
 * 片元着色器头部：ShaderToy 约定的 uniform 与 HSV 后处理。
 */
export const SILK_SHADER_HEADER = `#version 300 es
#ifdef GL_ES
precision highp float;
precision highp int;
#endif

uniform vec3      iResolution;     // viewport resolution (in pixels)
uniform float     iTime;           // shader playback time (in seconds)
uniform float     iTimeDelta;      // render time (in seconds)
uniform float     iFrameRate;      // shader frame rate
uniform int       iFrame;          // shader playback frame
uniform vec4      iMouse;          // mouse pixel coords. xy: current, zw: click
uniform vec4      iDate;           // (year, month, day, unixtime in seconds)
uniform vec3      iHSV;            // HSV controls (hue, saturation, brightness)
uniform float     iSpeed;          // speed multiplier

out vec4 fragColor;

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// Apply HSV adjustments
vec3 applyHSV(vec3 color, vec3 hsvAdjust) {
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + hsvAdjust.x / 360.0);
    hsv.y = clamp(hsv.y * hsvAdjust.y, 0.0, 1.0);
    hsv.z = clamp(hsv.z * hsvAdjust.z, 0.0, 1.0);
    return hsv2rgb(hsv);
}

void mainImage(out vec4 c, in vec2 f);

void main() {
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    mainImage(color, gl_FragCoord.xy);

    // Apply HSV adjustments if not default
    if (iHSV.x != 0.0 || iHSV.y != 1.0 || iHSV.z != 1.0) {
        color.rgb = applyHSV(color.rgb, iHSV);
    }

    fragColor = color;
}
`

/** 主体：丝绸 / 织物噪声 */
export const SILK_SHADER_BODY = `
#define INVERT 1

float noise(vec2 p) {
    return smoothstep(-0.5, 0.9, sin((p.x - p.y) * 555.0) * sin(p.y * 1444.0)) - 0.4;
}

float fabric(vec2 p) {
    const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    float f = 0.4 * noise(p);
    f += 0.3 * noise(p = m * p);
    f += 0.2 * noise(p = m * p);
    return f + 0.1 * noise(m * p);
}

float silkPair(vec2 uv, float t, out float d) {
    float xy = uv.x + uv.y;
    float a = 2.0 * uv.x + 5.0 * uv.y;
    float ca = cos(a);
    float arg = 5.0 * (xy + ca) + sin(12.0 * xy) - t;
    float s = sin(arg);
    s = 0.7 + 0.3 * (s * s * 0.5 + s);
    s *= 0.9 + 0.6 * fabric(uv * min(iResolution.x, iResolution.y) * 0.0006);
    d = (5.0 * (1.0 - 2.0 * sin(a)) + 12.0 * cos(12.0 * xy)) * cos(arg);
    d = 0.005 * d * (sign(d) + 3.0);
    return s * 0.9 + 0.1;
}

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    float mr = min(iResolution.x, iResolution.y);
    vec2 uv = fragCoord / mr;

    float t = iTime;
    uv.y += 0.03 * sin(8.0 * uv.x - t);

    float d;
    float s = sqrt(silkPair(uv, t, d));

    vec3 c = vec3(s);
    c += 0.7 * vec3(1, 0.83, 0.6) * d;
    c *= 1.0 - max(0.0, 0.8 * d);
#if INVERT
    c = pow(c, vec3(0.5769230769, 0.6, 0.75));
    c = 1.0 - c;
#else
    c = pow(c, vec3(0.52, 0.5, 0.4));
#endif

    fragColor = vec4(c, 1);
}
`

/** 完整片元着色器 */
export const SILK_FRAGMENT_SHADER = SILK_SHADER_HEADER + SILK_SHADER_BODY
