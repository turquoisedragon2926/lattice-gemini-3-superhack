import { useStore } from '../store'
import { PlayerTotem } from './PlayerTotem'
import { Ball } from './Ball'
import { DragPlane } from './DragPlane'
import type { PlayData, BallPhase } from '../types'

const AIRBORNE_EVENTS = new Set(['pass_forward'])
const GROUNDED_EVENTS = new Set([
  'pass_arrived', 'pass_outcome_caught', 'pass_outcome_incomplete',
  'ball_snap', 'run', 'tackle', 'touchdown', 'out_of_bounds',
  'fumble', 'handoff', 'first_contact',
])

function getBallPhase(play: PlayData, frameIndex: number): BallPhase {
  if (!play.events) return 'held'
  for (let i = frameIndex; i >= 0; i--) {
    const event = play.events[String(play.frames[i].id)]
    if (!event) continue
    if (AIRBORNE_EVENTS.has(event)) return 'airborne'
    if (GROUNDED_EVENTS.has(event)) return 'held'
  }
  return 'held'
}

function getAirborneProgress(play: PlayData, frameIndex: number): number {
  if (!play.events) return 0
  let passStart = -1
  let passEnd = -1
  // Find the pass_forward at or before current frame
  for (let i = frameIndex; i >= 0; i--) {
    const event = play.events[String(play.frames[i].id)]
    if (event === 'pass_forward') { passStart = i; break }
    if (event && GROUNDED_EVENTS.has(event)) return 0
  }
  if (passStart < 0) return 0
  // Find the pass_arrived/outcome after pass_forward
  for (let i = passStart + 1; i < play.frames.length; i++) {
    const event = play.events[String(play.frames[i].id)]
    if (event && GROUNDED_EVENTS.has(event)) { passEnd = i; break }
  }
  if (passEnd < 0) passEnd = Math.min(passStart + 20, play.frames.length - 1)
  const duration = passEnd - passStart
  if (duration <= 0) return 0
  return Math.max(0, Math.min(1, (frameIndex - passStart) / duration))
}

/** Scan backwards through recent frames to find position for a player (max 3 frames back) */
function getPlayerPosition(play: PlayData, frameIndex: number, id: string): [number, number] | undefined {
  const minFrame = Math.max(0, frameIndex - 3)
  for (let i = frameIndex; i >= minFrame; i--) {
    const pos = play.frames[i].positions[id]
    if (pos) return pos
  }
  return undefined
}

export function PlayerLayer() {
  const currentPlay = useStore((s) => s.currentPlay)
  const currentFrame = useStore((s) => s.currentFrame)
  const selectedPlayer = useStore((s) => s.selectedPlayer)
  const setSelectedPlayer = useStore((s) => s.setSelectedPlayer)
  const cameraMode = useStore((s) => s.cameraMode)
  const playing = useStore((s) => s.playing)
  const dragOverrides = useStore((s) => s.dragOverrides)

  if (!currentPlay || !currentPlay.frames[currentFrame]) return null

  const playerEntries = Object.entries(currentPlay.players).filter(
    ([id]) => id !== 'ball',
  )

  const ballOverride = dragOverrides['ball']
  const ballPos = ballOverride || getPlayerPosition(currentPlay, currentFrame, 'ball')
  const isDraggable = !playing
  const ballPhase = getBallPhase(currentPlay, currentFrame)
  const airborneProgress = getAirborneProgress(currentPlay, currentFrame)

  return (
    <group onClick={(e) => {
      if (e.object.type === 'Mesh' || e.object.type === 'Group') return
    }}>
      {playerEntries.map(([id, player]) => {
        const override = dragOverrides[id]
        const pos = override || getPlayerPosition(currentPlay, currentFrame, id)
        if (!pos) return null
        return (
          <PlayerTotem
            key={id}
            playerId={id}
            name={player.name}
            jersey={player.jersey ?? 0}
            position={player.position ?? ''}
            team={player.team === 'home' ? 'home' : 'away'}
            targetX={pos[0]}
            targetY={pos[1]}
            selected={selectedPlayer === id}
            isEgoTarget={selectedPlayer === id && cameraMode === 'ego'}
            onSelect={() => setSelectedPlayer(id)}
            isDraggable={isDraggable}
            onDragStart={() => useStore.getState().setSelectedPlayer(id)}
          />
        )
      })}
      {ballPos && (
        <Ball
          x={ballPos[0]}
          y={ballPos[1]}
          phase={ballPhase}
          airborneProgress={airborneProgress}
          selected={selectedPlayer === 'ball'}
          onSelect={() => setSelectedPlayer('ball')}
          isDraggable={isDraggable}
        />
      )}
      <DragPlane />
    </group>
  )
}
