import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'

const vertexShader = `
  uniform sampler2D map;
  uniform float width;
  uniform float height;
  uniform float nearClipping;
  uniform float farClipping;
  uniform float pointSize;
  uniform float zOffset;
  uniform float circleRadius;

  varying vec2 vUv;

  const float XtoZ = 1.11146; // tan( 1.0144686 / 2.0 ) * 2.0;
  const float YtoZ = 0.83359; // tan( 0.7898090 / 2.0 ) * 2.0;

  void main() {
    vUv = vec2( position.x / width, position.y / height );

    if (distance(vUv, vec2(0.5, 0.5)) > circleRadius) {
      gl_PointSize = 0.0;
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec4 color = texture2D( map, vUv );
    float depth = ( color.r + color.g + color.b ) / 3.0;

    float z = ( 1.0 - depth ) * (farClipping - nearClipping) + nearClipping;

    vec4 pos = vec4(
      ( position.x / width - 0.5 ) * z * XtoZ,
      ( position.y / height - 0.5 ) * z * YtoZ,
      - z + zOffset,
      1.0
    );

    gl_PointSize = pointSize;
    gl_Position = projectionMatrix * modelViewMatrix * pos;
  }
`

const fragmentShader = `
  uniform sampler2D map;
  uniform vec3 videoColor; // New uniform for video tint
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D( map, vUv );
    // Apply videoColor tint and maintain alpha
    gl_FragColor = vec4( color.rgb * videoColor, 0.8 );
  }
`

export function KinectScene() {
  const meshRef = useRef<THREE.Points>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const textureRef = useRef<THREE.VideoTexture>(null)
  const mouseRef = useRef(new THREE.Vector3(0, 0, 1))
  const centerRef = useRef(new THREE.Vector3(0, 0, -1000))

  const { camera } = useThree()

  // State to manage video loading status
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null)
  const [_videoPlaying, setVideoPlaying] = useState(false)

  // Leva controls for shader uniforms, starting collapsed
  const { nearClipping, farClipping, pointSize, zOffset, circleRadius, bgColor, videoColor } = useControls({
    nearClipping: { value: 850, min: 1, max: 10000, step: 1 },
    farClipping: { value: 4000, min: 1, max: 10000, step: 1 },
    pointSize: { value: 2, min: 1, max: 10, step: 1 },
    zOffset: { value: 1000, min: 0, max: 4000, step: 1 },
    circleRadius: { value: 0.7, min: 0.0, max: 0.7, step: 0.01 },
    bgColor: { value: '#ffffff' },
    videoColor: { value: '#0300ff' }
  })

  // Create geometry and material
  const { geometry, material } = useMemo(() => {
    const width = 640
    const height = 480

    const geo = new THREE.BufferGeometry()
    const vertices = new Float32Array(width * height * 3)

    for (let i = 0, j = 0, l = vertices.length; i < l; i += 3, j++) {
      vertices[i] = j % width
      vertices[i + 1] = Math.floor(j / width)
    }

    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null },
        width: { value: width },
        height: { value: height },
        nearClipping: { value: 850 },
        farClipping: { value: 4000 },
        pointSize: { value: 2 },
        zOffset: { value: 1000 },
        circleRadius: { value: 0.5 },
        videoColor: { value: new THREE.Color('#cccccc') }
      },
      vertexShader,
      fragmentShader,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: true,
      transparent: true
    })

    return { geometry: geo, material: mat }
  }, [])

  // Setup video and texture
  useEffect(() => {
    const video = document.createElement('video')
    video.src = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/testMovie-nJSNfpIuLib3BkQoMi5t2libqPSPui.mp4'
    video.loop = true
    video.muted = true
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.style.display = 'none'

    const handleVideoError = (e: Event) => {
      console.error('Video error event:', e)
      setVideoLoadError(`Не удалось загрузить видео. Код ошибки: ${video.error?.code || 'неизвестно'}. Сообщение: ${video.error?.message || 'Нет сообщения.'} Попробуйте кликнуть по экрану.`)
      setVideoPlaying(false)
    }

    const handleVideoPlay = () => {
      setVideoPlaying(true)
      setVideoLoadError(null)
    }

    video.addEventListener('error', handleVideoError)
    video.addEventListener('play', handleVideoPlay)

    document.body.appendChild(video)
    videoRef.current = video

    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    textureRef.current = texture

    if (material && material.uniforms && material.uniforms.map) {
      material.uniforms.map.value = texture
    }

    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Video started playing (initial attempt)')
          setVideoPlaying(true)
          setVideoLoadError(null)
        })
        .catch((error) => {
          console.error('Error playing video (initial attempt):', error)
          setVideoLoadError('Автовоспроизведение заблокировано. Кликните в любом месте экрана для запуска.')
          setVideoPlaying(false)
          const playOnClick = () => {
            if (videoRef.current && !videoRef.current.paused) {
              document.removeEventListener('click', playOnClick)
              return
            }
            videoRef.current?.play()
              .then(() => {
                console.log('Video started playing (via click)')
                setVideoPlaying(true)
                setVideoLoadError(null)
                document.removeEventListener('click', playOnClick)
              })
              .catch((clickError) => {
                console.error('Error playing video (via click):', clickError)
                setVideoLoadError(`Не удалось воспроизвести видео даже после клика. Ошибка: ${clickError.message || 'неизвестно'}.`)
              })
          }
          document.addEventListener('click', playOnClick)
        })
    }

    return () => {
      if (document.body.contains(video)) {
        video.removeEventListener('error', handleVideoError)
        video.removeEventListener('play', handleVideoPlay)
        document.body.removeChild(video)
      }
      if (textureRef.current) {
        textureRef.current.dispose()
      }
    }
  }, [material])

  // Update material uniforms when controls change
  useEffect(() => {
    if (meshRef.current && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      if (mat.uniforms) {
        mat.uniforms.nearClipping.value = nearClipping
        mat.uniforms.farClipping.value = farClipping
        mat.uniforms.pointSize.value = pointSize
        mat.uniforms.zOffset.value = zOffset
        mat.uniforms.circleRadius.value = circleRadius
        mat.uniforms.videoColor.value.set(videoColor)
      }
    }
  }, [nearClipping, farClipping, pointSize, zOffset, circleRadius, videoColor])

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX - window.innerWidth / 2) * 8
      mouseRef.current.y = (event.clientY - window.innerHeight / 2) * 8
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Animation loop
  useFrame(() => {
    // Smooth camera movement following mouse
    camera.position.x += (mouseRef.current.x - camera.position.x) * 0.01
    camera.position.y += (-mouseRef.current.y - camera.position.y) * 0.01
    camera.lookAt(centerRef.current)
  })

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <Environment preset="sunset" />
      <points ref={meshRef} geometry={geometry} material={material} />
      {videoLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white text-center p-4 z-50">
          <p className="text-lg font-bold">{videoLoadError}</p>
        </div>
      )}
    </>
  )
}
