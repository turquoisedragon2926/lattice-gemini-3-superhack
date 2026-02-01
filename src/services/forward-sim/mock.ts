import type { ForwardSimulator, SimulationInput, CanonicalPlay, Frame } from '../types.js'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const FRICTION = 0.95
const DT = 0.1 // 10 Hz
const DRIFT_STRENGTH = 0.8 // lateral acceleration magnitude (yards/s²)
const NOISE_VELOCITY = 1.2  // random velocity jitter per frame (yards/s)
const NOISE_FRICTION = 0.03 // per-run friction variation (±)

/** Simple deterministic hash of a string → number in [0, 1) */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return (Math.abs(h) % 10000) / 10000
}

/** Box-Muller transform: returns a sample from N(0, 1) */
function randn(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2)
}

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

    // Per-player drift parameters (deterministic base from player ID + random per run)
    const driftParams: Record<string, { phase: number; freq: number; frictionMul: number }> = {}
    for (const id of Object.keys(current)) {
      const h = hashId(id)
      driftParams[id] = {
        phase: h * Math.PI * 2 + Math.random() * Math.PI,  // base + random phase jitter
        freq: 1.5 + h * 2.0 + (Math.random() - 0.5) * 1.0, // freq jitter
        frictionMul: FRICTION + (Math.random() - 0.5) * 2 * NOISE_FRICTION, // per-player friction variation
      }
    }

    const frames: Frame[] = []

    for (let i = 1; i <= horizon; i++) {
      const positions: Record<string, [number, number]> = {}
      const velocities: Record<string, [number, number]> = {}
      const orientations: Record<string, number> = {}

      for (const [id, p] of Object.entries(current)) {
        const drift = driftParams[id]
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)

        // Add lateral drift proportional to speed (so stationary players don't wander)
        if (drift && speed > 0.5) {
          const t = i * DT
          const lateralAccel = Math.sin(drift.freq * t + drift.phase) * DRIFT_STRENGTH
          // Perpendicular to velocity direction
          const nx = -p.vy / speed
          const ny = p.vx / speed
          p.vx += nx * lateralAccel * DT
          p.vy += ny * lateralAccel * DT

          // Random velocity noise (Gaussian, scaled by current speed)
          p.vx += randn() * NOISE_VELOCITY * DT
          p.vy += randn() * NOISE_VELOCITY * DT
        }

        // Integrate position
        p.x = clamp(p.x + p.vx * DT, 0, 120)
        p.y = clamp(p.y + p.vy * DT, 0, 53.3)

        // Apply friction (with per-player variation)
        const fric = drift ? drift.frictionMul : FRICTION
        p.vx *= fric
        p.vy *= fric

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
