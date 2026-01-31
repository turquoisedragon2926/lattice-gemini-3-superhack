import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import {
  generateBoundaryLines,
  generateEndzoneBoundaries,
  generateYardLines,
  generateHashMarks,
  generateSubGrid,
  generateYardLabels,
} from '../utils/fieldGeometry'
import {
  CYAN_HEX,
  WHITE_HEX,
  SUBGRID_OPACITY,
  YARD_LINE_OPACITY,
  BOUNDARY_OPACITY,
  HASH_OPACITY,
  FIELD_HALF_LENGTH,
  FIELD_HALF_WIDTH,
} from '../utils/constants'

function LineLayer({
  vertices,
  color,
  opacity,
}: {
  vertices: Float32Array
  color: number
  opacity: number
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    return geo
  }, [vertices])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  )
}

function PulseGrid() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const shader = useMemo(
    () => ({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00e5ff) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float dist = length(vUv - vec2(0.5));
          float wave = sin(dist * 20.0 - uTime * 1.5) * 0.5 + 0.5;
          wave = pow(wave, 8.0);
          float alpha = wave * 0.08;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[FIELD_HALF_LENGTH * 2, FIELD_HALF_WIDTH * 2]} />
      <shaderMaterial
        ref={materialRef}
        args={[shader]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function Field() {
  const boundary = useMemo(() => generateBoundaryLines(), [])
  const endzones = useMemo(() => generateEndzoneBoundaries(), [])
  const yardLines = useMemo(() => generateYardLines(), [])
  const hashMarks = useMemo(() => generateHashMarks(), [])
  const subGrid = useMemo(() => generateSubGrid(), [])
  const labels = useMemo(() => generateYardLabels(), [])

  return (
    <group>
      <LineLayer vertices={subGrid} color={CYAN_HEX} opacity={SUBGRID_OPACITY} />
      <LineLayer vertices={yardLines} color={CYAN_HEX} opacity={YARD_LINE_OPACITY} />
      <LineLayer vertices={endzones} color={WHITE_HEX} opacity={YARD_LINE_OPACITY} />
      <LineLayer vertices={hashMarks} color={CYAN_HEX} opacity={HASH_OPACITY} />
      <LineLayer vertices={boundary} color={WHITE_HEX} opacity={BOUNDARY_OPACITY} />
      <PulseGrid />
      {labels.map((label, i) => (
        <Text
          key={i}
          position={label.position}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.8}
          color="#e0e0e0"
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf"
          fillOpacity={0.3}
        >
          {label.text}
        </Text>
      ))}
    </group>
  )
}
