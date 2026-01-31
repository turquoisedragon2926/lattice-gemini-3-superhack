import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toScene, WHITE_HEX, CYAN_HEX } from '../utils/constants'
import { lerp } from '../utils/interpolation'
import type { BallPhase } from '../types'

const TRAIL_LENGTH = 8

interface BallProps {
  x: number
  y: number
  phase: BallPhase
  airborneProgress: number
  selected?: boolean
  onSelect?: () => void
  isDraggable?: boolean
}

export function Ball({ x, y, phase, airborneProgress, selected, onSelect, isDraggable }: BallProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const trailRef = useRef<THREE.Vector3[]>([])
  const trailMeshes = useRef<THREE.Mesh[]>([])
  const target = toScene(x, y)
  const isAirborne = phase === 'airborne'

  // Parabolic arc when airborne
  target[1] = isAirborne
    ? 0.5 + Math.sin(airborneProgress * Math.PI) * 4
    : 0.5

  const currentPos = useRef<[number, number, number]>([...target])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const f = Math.min(1, delta * 10)
    currentPos.current[0] = lerp(currentPos.current[0], target[0], f)
    currentPos.current[1] = lerp(currentPos.current[1], target[1], f)
    currentPos.current[2] = lerp(currentPos.current[2], target[2], f)
    meshRef.current.position.set(
      currentPos.current[0],
      currentPos.current[1],
      currentPos.current[2],
    )

    // Update point light
    if (lightRef.current) {
      lightRef.current.position.copy(meshRef.current.position)
      lightRef.current.intensity = isAirborne ? 2 : 0
    }

    // Update trail
    if (isAirborne) {
      const pos = new THREE.Vector3(...currentPos.current)
      trailRef.current.push(pos)
      if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.shift()
    } else {
      trailRef.current.length = 0
    }

    // Position trail meshes
    for (let i = 0; i < trailMeshes.current.length; i++) {
      const m = trailMeshes.current[i]
      if (!m) continue
      const tp = trailRef.current[i]
      if (tp) {
        m.visible = true
        m.position.copy(tp)
        const opacity = ((i + 1) / TRAIL_LENGTH) * 0.4
        ;(m.material as THREE.MeshBasicMaterial).opacity = opacity
      } else {
        m.visible = false
      }
    }
  })

  const color = isAirborne ? CYAN_HEX : WHITE_HEX

  return (
    <group>
      <mesh
        ref={meshRef}
        position={target}
        onClick={(e) => { if (onSelect) { e.stopPropagation(); onSelect() } }}
        onPointerDown={(e) => { if (isDraggable && selected) e.stopPropagation() }}
      >
        <icosahedronGeometry args={[0.3, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={isAirborne ? 1.0 : 0.8} />
      </mesh>
      {selected && (
        <mesh position={target} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 24]} />
          <meshBasicMaterial color={CYAN_HEX} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      <pointLight ref={lightRef} color={0x00e5ff} intensity={0} distance={8} />
      {Array.from({ length: TRAIL_LENGTH }).map((_, i) => (
        <mesh
          key={i}
          visible={false}
          ref={(el) => { if (el) trailMeshes.current[i] = el }}
        >
          <icosahedronGeometry args={[0.15, 0]} />
          <meshBasicMaterial color={CYAN_HEX} wireframe transparent opacity={0} />
        </mesh>
      ))}
    </group>
  )
}
