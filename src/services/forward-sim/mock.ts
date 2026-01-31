import type { ForwardSimulator, SimulationInput, CanonicalPlay, Frame } from '../types.js'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const FRICTION = 0.97
const DT = 0.1 // 10 Hz

export class MockForwardSimulator implements ForwardSimulator {
  async predict(input: SimulationInput): Promise<CanonicalPlay> {
    const { gameId, playId, frameId, horizon, state, players } = input

    // Build mutable copy of state
    const current: Record<string, { x: number; y: number; vx: number; vy: number; ori: number }> = {}
    for (const [id, snap] of Object.entries(state)) {
      current[id] = {
        x: snap.pos[0],
        y: snap.pos[1],
        vx: snap.vel[0],
        vy: snap.vel[1],
        ori: snap.ori,
      }
    }

    const frames: Frame[] = []

    for (let i = 1; i <= horizon; i++) {
      const positions: Record<string, [number, number]> = {}
      const velocities: Record<string, [number, number]> = {}
      const orientations: Record<string, number> = {}

      for (const [id, p] of Object.entries(current)) {
        // Integrate position
        p.x = clamp(p.x + p.vx * DT, 0, 120)
        p.y = clamp(p.y + p.vy * DT, 0, 53.3)

        // Apply friction
        p.vx *= FRICTION
        p.vy *= FRICTION

        positions[id] = [round2(p.x), round2(p.y)]
        velocities[id] = [round2(p.vx), round2(p.vy)]
        orientations[id] = round2(p.ori)
      }

      frames.push({ id: frameId + i, positions, velocities, orientations })
    }

    return {
      gameId,
      playId,
      frameCount: horizon,
      events: {},
      players,
      frames,
      source: 'mock',
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
