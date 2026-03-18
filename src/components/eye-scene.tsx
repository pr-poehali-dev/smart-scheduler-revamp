import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'

const vertexShader = `
  uniform float time;
  uniform float pointSize;
  uniform float irisRadius;
  uniform float pupilRadius;
  uniform float depthScale;
  uniform float scleraDepth;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    float dist = length(pos.xy);

    // Глубина: роговица выпуклая, склера плоская
    float eyeDepth = 0.0;

    if (dist < pupilRadius) {
      // Зрачок — глубокая впадина
      eyeDepth = -depthScale * 0.6 * (1.0 - dist / pupilRadius);
      vColor = vec3(0.02, 0.02, 0.04);
      vAlpha = 0.95;
    } else if (dist < irisRadius) {
      // Радужка — куполообразная выпуклость
      float t = (dist - pupilRadius) / (irisRadius - pupilRadius);
      eyeDepth = depthScale * 0.5 * (1.0 - t * t);

      // Цвет радужки: синий/серый с золотыми прожилками
      float angle = atan(pos.y, pos.x);
      float fibers = sin(angle * 40.0 + dist * 80.0) * 0.5 + 0.5;
      float ring = sin(dist * 120.0 + time * 0.3) * 0.5 + 0.5;

      vec3 irisBase = vec3(0.15, 0.35, 0.65);
      vec3 irisGold = vec3(0.6, 0.45, 0.1);
      vec3 irisDark = vec3(0.05, 0.15, 0.35);

      vColor = mix(mix(irisDark, irisBase, fibers), irisGold, ring * 0.25);
      vAlpha = 0.9;
    } else if (dist < 1.0) {
      // Склера (белок)
      float t = (dist - irisRadius) / (1.0 - irisRadius);
      eyeDepth = -scleraDepth * t * t;

      // Лёгкие красноватые прожилки
      float vein = max(0.0, sin(pos.x * 30.0 + pos.y * 15.0 + time * 0.1) * 0.5 + 0.5 - 0.75) * 4.0;
      float vein2 = max(0.0, sin(pos.x * 20.0 - pos.y * 25.0 + time * 0.08) * 0.5 + 0.5 - 0.8) * 3.0;
      vColor = vec3(0.92 + vein * 0.08, 0.88 - vein * 0.1, 0.86 - vein * 0.15);
      vColor -= vec3(vein2 * 0.05, vein2 * 0.08, vein2 * 0.08);
      vAlpha = 0.75 - t * 0.3;
    } else {
      vColor = vec3(0.0);
      vAlpha = 0.0;
    }

    pos.z = eyeDepth;

    // Лёгкое дрожание зрачка
    if (dist < pupilRadius) {
      pos.z += sin(time * 0.8 + dist * 20.0) * depthScale * 0.02;
    }

    gl_PointSize = pointSize * (1.0 - dist * 0.3);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.01) discard;

    // Круглые точки
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;

    float edgeSoft = 1.0 - smoothstep(0.6, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * edgeSoft);
  }
`

export function EyeScene() {
  const meshRef = useRef<THREE.Points>(null)
  const mouseRef = useRef(new THREE.Vector2(0, 0))
  const timeRef = useRef(0)

  const { camera } = useThree()

  const { pointSize, depthScale, bgColor, irisRadius, pupilRadius } = useControls({
    pointSize: { value: 3.5, min: 1, max: 8, step: 0.5 },
    depthScale: { value: 60, min: 10, max: 150, step: 5 },
    irisRadius: { value: 0.42, min: 0.2, max: 0.65, step: 0.01 },
    pupilRadius: { value: 0.16, min: 0.05, max: 0.4, step: 0.01 },
    bgColor: { value: '#0a0a12' },
  })

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 180000
    const positions = new Float32Array(count * 3)

    let idx = 0
    for (let i = 0; i < count; i++) {
      // Полярное распределение для более естественного глаза
      const r = Math.sqrt(Math.random()) * 1.05
      const theta = Math.random() * Math.PI * 2

      positions[idx++] = Math.cos(theta) * r
      positions[idx++] = Math.sin(theta) * r
      positions[idx++] = 0
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pointSize: { value: 3.5 },
        irisRadius: { value: 0.42 },
        pupilRadius: { value: 0.16 },
        depthScale: { value: 60 },
        scleraDepth: { value: 20 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
  }, [])

  // Обновляем uniforms из leva
  useEffect(() => {
    if (material?.uniforms) {
      material.uniforms.pointSize.value = pointSize
      material.uniforms.depthScale.value = depthScale
      material.uniforms.irisRadius.value = irisRadius
      material.uniforms.pupilRadius.value = pupilRadius
    }
  }, [pointSize, depthScale, irisRadius, pupilRadius, material])

  // Мышь
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useFrame(({ clock }) => {
    timeRef.current = clock.getElapsedTime()

    if (material?.uniforms) {
      material.uniforms.time.value = timeRef.current
    }

    // Камера следит за мышью — как взгляд глаза
    const targetX = mouseRef.current.x * 30
    const targetY = mouseRef.current.y * 20
    camera.position.x += (targetX - camera.position.x) * 0.04
    camera.position.y += (targetY - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
  })

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <points ref={meshRef} geometry={geometry} material={material} />
    </>
  )
}
