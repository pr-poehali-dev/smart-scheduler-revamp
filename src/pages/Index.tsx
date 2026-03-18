import { Canvas } from '@react-three/fiber'
import { EyeScene } from '@/components/eye-scene'
import { Leva } from 'leva'

export default function Index() {
  return (
    <div className="w-full h-screen relative bg-[#0a0a12]">
      <Canvas
        camera={{
          position: [0, 0, 1.8],
          fov: 45,
          near: 0.01,
          far: 1000,
        }}
        gl={{ alpha: false, antialias: false }}
      >
        <EyeScene />
      </Canvas>

      <Leva collapsed={true} />

      {/* Заголовок */}
      <div className="absolute top-6 left-6 pointer-events-none">
        <div className="text-white/90 font-light text-xl tracking-[0.3em] uppercase">
          Human Eye
        </div>
        <div className="text-white/35 text-xs tracking-widest mt-1">
          voxel · 3d · interactive
        </div>
      </div>

      {/* Подсказка */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/25 text-xs tracking-widest uppercase pointer-events-none">
        move cursor to look around
      </div>
    </div>
  )
}
