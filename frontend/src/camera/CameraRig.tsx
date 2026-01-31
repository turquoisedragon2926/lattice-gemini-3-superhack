import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import {
  PERSPECTIVE_POSITION,
  AUTO_ROTATE_SPEED,
  IDLE_TIMEOUT_MS,
  FIELD_HALF_LENGTH,
  FIELD_HALF_WIDTH,
} from '../utils/constants'
import { EgoCamera } from './EgoCamera'

export function CameraRig() {
  const cameraMode = useStore((s) => s.cameraMode)
  const setCameraMode = useStore((s) => s.setCameraMode)
  const controlsRef = useRef<any>(null)
  const idleTimerRef = useRef<number | null>(null)
  const autoRotatingRef = useRef(true)
  const { gl } = useThree()

  const resetIdleTimer = useCallback(() => {
    if (cameraMode !== '3d') return
    autoRotatingRef.current = false
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false
    }
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = window.setTimeout(() => {
      autoRotatingRef.current = true
      if (controlsRef.current) {
        controlsRef.current.autoRotate = true
      }
    }, IDLE_TIMEOUT_MS)
  }, [cameraMode])

  useEffect(() => {
    const canvas = gl.domElement
    const handler = () => resetIdleTimer()
    canvas.addEventListener('pointerdown', handler)
    canvas.addEventListener('wheel', handler)
    return () => {
      canvas.removeEventListener('pointerdown', handler)
      canvas.removeEventListener('wheel', handler)
      if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current)
    }
  }, [gl, resetIdleTimer])

  useEffect(() => {
    if (cameraMode === '3d' && controlsRef.current) {
      controlsRef.current.autoRotate = true
      autoRotatingRef.current = true
    }
  }, [cameraMode])

  if (cameraMode === 'ego') {
    return <EgoCamera />
  }

  if (cameraMode === 'top') {
    const frustumSize = FIELD_HALF_LENGTH + 10
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1
    return (
      <>
        <OrthographicCamera
          makeDefault
          position={[0, 100, 0]}
          zoom={1}
          left={-frustumSize * aspect}
          right={frustumSize * aspect}
          top={frustumSize}
          bottom={-frustumSize}
          near={0.1}
          far={200}
        />
        <OrbitControls
          enableRotate={false}
          enablePan={true}
          enableZoom={true}
          target={[0, 0, 0]}
          minZoom={0.3}
          maxZoom={5}
        />
      </>
    )
  }

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={PERSPECTIVE_POSITION}
        fov={50}
        near={0.1}
        far={500}
      />
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        autoRotate
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  )
}
