import { Canvas } from '@react-three/fiber'
import { KinectScene } from '@/components/kinect-scene'
import { Leva } from 'leva'

export default function Index() {
  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{
          position: [0, 0, 500],
          fov: 50,
          near: 1,
          far: 10000
        }}
        gl={{ alpha: false }}
        scene={{ background: null }}
      >
        <KinectScene />
      </Canvas>
      <Leva collapsed={true} />
      <div className="absolute top-4 left-4 text-black font-medium font-sans text-2xl">
        Voxel Canvas
      </div>
      <div className="absolute bottom-4 right-4 text-black font-medium font-sans text-xl">
        <a
          href="https://threejs.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Работает на Three.js
        </a>
      </div>
    </div>
  )
}
