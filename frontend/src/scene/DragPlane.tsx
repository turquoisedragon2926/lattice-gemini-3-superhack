import { useRef, useState } from 'react'
import { useStore } from '../store'
import { FIELD_HALF_LENGTH, FIELD_HALF_WIDTH } from '../utils/constants'

export function DragPlane() {
  const playing = useStore((s) => s.playing)
  const selectedPlayer = useStore((s) => s.selectedPlayer)
  const setDragOverride = useStore((s) => s.setDragOverride)
  const [dragging, setDragging] = useState(false)

  if (playing || !selectedPlayer) return null

  return (
    <mesh
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
      onPointerDown={(e) => {
        e.stopPropagation()
        setDragging(true)
        ;(e.target as any).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!dragging || !selectedPlayer) return
        e.stopPropagation()
        const fieldX = e.point.x + FIELD_HALF_LENGTH
        const fieldY = e.point.z + FIELD_HALF_WIDTH
        setDragOverride(selectedPlayer, [fieldX, fieldY])
      }}
      onPointerUp={() => setDragging(false)}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
