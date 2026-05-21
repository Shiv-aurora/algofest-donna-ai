import React, { useEffect, useRef } from 'react'

const cn = (...classes) => classes.filter(Boolean).join(' ')

const ZOOM_FACTOR = 0.3
const BASE_WAVE_AMPLITUDE = 0.2
const RANDOM_WAVE_FACTOR = 0.15
const WAVE_FREQUENCY = 4.0
const TIME_FACTOR = 0.2
const BASE_SWIRL_STRENGTH = 1.2
const SWIRL_TIME_MULT = 5.0
const NOISE_SWIRL_FACTOR = 0.2
const FBM_OCTAVES = 10

const METALLIC_PALETTE = [
  [0.03, 0.03, 0.04],
  [0.05, 0.05, 0.06],
  [0.08, 0.08, 0.09],
  [0.11, 0.11, 0.12],
  [0.14, 0.14, 0.15],
  [0.18, 0.18, 0.19],
  [0.22, 0.22, 0.23],
  [0.27, 0.27, 0.28],
  [0.32, 0.32, 0.33],
  [0.38, 0.38, 0.39],
  [0.45, 0.45, 0.46],
  [0.53, 0.53, 0.54],
  [0.61, 0.61, 0.62],
  [0.69, 0.69, 0.7],
  [0.76, 0.76, 0.77],
  [0.82, 0.83, 0.84],
  [0.87, 0.88, 0.89],
  [0.91, 0.92, 0.93],
  [0.95, 0.96, 0.97],
  [0.98, 0.99, 1.0]
]

const SUBTLE_METALLIC_PALETTE = [
  [0.36, 0.38, 0.41],
  [0.38, 0.4, 0.43],
  [0.4, 0.42, 0.45],
  [0.42, 0.44, 0.47],
  [0.44, 0.46, 0.49],
  [0.46, 0.48, 0.51],
  [0.48, 0.5, 0.53],
  [0.5, 0.52, 0.55],
  [0.52, 0.54, 0.57],
  [0.54, 0.56, 0.59],
  [0.56, 0.58, 0.61],
  [0.58, 0.6, 0.63],
  [0.6, 0.62, 0.65],
  [0.62, 0.64, 0.67],
  [0.64, 0.66, 0.69],
  [0.66, 0.68, 0.71],
  [0.68, 0.7, 0.73],
  [0.72, 0.74, 0.77],
  [0.76, 0.78, 0.81],
  [0.82, 0.84, 0.87]
]

function buildFragmentShader(variant = 'default') {
  const fbmOctavesInt = Math.floor(FBM_OCTAVES)
  const palette = variant === 'subtle' ? SUBTLE_METALLIC_PALETTE : METALLIC_PALETTE
  const alpha = variant === 'subtle' ? 0.95 : 0.88
  const colorArraySrc = palette.map((c) => `vec3(${c[0]}, ${c[1]}, ${c[2]})`).join(',\n  ')

  return `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;

#define NUM_COLORS 20

vec3 seaColors[NUM_COLORS] = vec3[](
  ${colorArraySrc}
);

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float noise2D(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) +
    i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.792843 - 0.853734 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float freq = 1.0;
  for (int i = 0; i < ${fbmOctavesInt}; i++) {
    value += amplitude * noise2D(st * freq);
    freq *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  uv *= float(${ZOOM_FACTOR});

  float t = uTime * float(${TIME_FACTOR});

  float waveAmp = float(${BASE_WAVE_AMPLITUDE}) + float(${RANDOM_WAVE_FACTOR})
                  * noise2D(vec2(t, 27.7));

  float waveX = waveAmp * sin(uv.y * float(${WAVE_FREQUENCY}) + t);
  float waveY = waveAmp * sin(uv.x * float(${WAVE_FREQUENCY}) - t);
  uv.x += waveX;
  uv.y += waveY;

  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float swirlStrength = float(${BASE_SWIRL_STRENGTH})
                        * (1.0 - smoothstep(0.0, 1.0, r));

  angle += swirlStrength * sin(uTime + r * float(${SWIRL_TIME_MULT}));
  uv = vec2(cos(angle), sin(angle)) * r;

  float n = fbm(uv);

  float swirlEffect = float(${NOISE_SWIRL_FACTOR})
                      * sin(t + n * 3.0);
  n += swirlEffect;

  float noiseVal = 0.5 * (n + 1.0);

  float idx = clamp(noiseVal, 0.0, 1.0) * float(NUM_COLORS - 1);
  int iLow = int(floor(idx));
  int iHigh = int(min(float(iLow + 1), float(NUM_COLORS - 1)));
  float f = fract(idx);

  vec3 colLow = seaColors[iLow];
  vec3 colHigh = seaColors[iHigh];
  vec3 color = mix(colLow, colHigh, f);

  outColor = vec4(color, ${alpha});
}
`
}

const vertexShaderSource = `#version 300 es
precision mediump float;

in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

function createShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)
  if (!vertexShader) return null
  gl.shaderSource(vertexShader, vsSource)
  gl.compileShader(vertexShader)
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader))
    gl.deleteShader(vertexShader)
    return null
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
  if (!fragmentShader) {
    gl.deleteShader(vertexShader)
    return null
  }
  gl.shaderSource(fragmentShader, fsSource)
  gl.compileShader(fragmentShader)
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader))
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Could not link WebGL program:', gl.getProgramInfoLog(program))
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    gl.deleteProgram(program)
    return null
  }

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  return program
}

export default function DashboardClockBackground({ children, className, variant = 'default', timeScale = 1 }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return undefined

    const gl = canvas.getContext('webgl2', { alpha: true })
    if (!gl) {
      console.error('WebGL2 is not supported by this browser.')
      return undefined
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    const fsSource = buildFragmentShader(variant)
    const program = createShaderProgram(gl, vertexShaderSource, fsSource)
    if (!program) return undefined

    gl.useProgram(program)

    const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const vao = gl.createVertexArray()
    const vbo = gl.createBuffer()
    if (!vao || !vbo) {
      gl.deleteProgram(program)
      return undefined
    }

    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)

    const aPositionLoc = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(aPositionLoc)
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0)

    const uResolutionLoc = gl.getUniformLocation(program, 'uResolution')
    const uTimeLoc = gl.getUniformLocation(program, 'uTime')

    const resizeCanvas = () => {
      const width = Math.max(1, Math.floor(container.clientWidth))
      const height = Math.max(1, Math.floor(container.clientHeight))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
    }

    resizeCanvas()
    let rafId = 0
    const startTime = performance.now()

    const render = () => {
      resizeCanvas()
      const elapsed = (performance.now() - startTime) * 0.001

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      if (uResolutionLoc) gl.uniform2f(uResolutionLoc, canvas.width, canvas.height)
      if (uTimeLoc) gl.uniform1f(uTimeLoc, elapsed * timeScale)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      rafId = requestAnimationFrame(render)
    }

    render()

    const observer = new ResizeObserver(() => resizeCanvas())
    observer.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      gl.deleteProgram(program)
      gl.deleteBuffer(vbo)
      gl.deleteVertexArray(vao)
    }
  }, [variant, timeScale])

  const overlayStyle =
    variant === 'subtle'
      ? {
          background:
            'linear-gradient(120deg, rgba(255,255,255,0.08) 0%, rgba(235,238,242,0.06) 42%, rgba(168,176,186,0.08) 100%)'
        }
      : {
          background:
            'linear-gradient(120deg, rgba(255,255,255,0.18) 0%, rgba(205,208,214,0.08) 38%, rgba(24,24,28,0.14) 62%, rgba(245,246,248,0.16) 100%)'
        }

  const canvasStyle =
    variant === 'subtle' ? { background: 'transparent', filter: 'brightness(0.9) contrast(1.14)' } : { background: 'transparent' }

  return (
    <div ref={containerRef} className={cn('relative w-full overflow-hidden', className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={canvasStyle} />
      <div className="pointer-events-none absolute inset-0" style={overlayStyle} />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
