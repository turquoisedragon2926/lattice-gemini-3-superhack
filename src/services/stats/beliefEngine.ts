import type { CanonicalPlay, SimulationInput, PlayerSnapshot } from '../types.js'
import type { ForwardSimulator } from '../forward-sim/index.js'
import type {
  FramePosterior,
  BeliefDelta,
  OutcomeDistribution,
  PlayStats,
  PlayerAttribution,
  PlayerFrameStats,
  PosteriorTrajectory,
} from './types.js'

const NUM_SIMS = 20
const HORIZON = 30 // 3 seconds forward at 10Hz
const KL_PIVOT_THRESHOLD = 0.05
const TOP_PIVOTAL = 5

/** Add gaussian noise to a value */
function jitter(val: number, scale: number): number {
  // Box-Muller
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
  return val + z * scale
}

/** Build SimulationInput from a CanonicalPlay at a given frame, with optional noise */
function buildSimInput(
  play: CanonicalPlay,
  frameIdx: number,
  noiseScale: number = 0,
): SimulationInput {
  const frame = play.frames[frameIdx]
  const state: Record<string, PlayerSnapshot> = {}

  for (const [id, info] of Object.entries(play.players)) {
    const pos = frame.positions[id]
    const vel = frame.velocities[id]
    if (!pos) continue
    state[id] = {
      pos: noiseScale > 0
        ? [jitter(pos[0], noiseScale), jitter(pos[1], noiseScale)]
        : [...pos],
      vel: vel
        ? (noiseScale > 0
          ? [jitter(vel[0], noiseScale * 0.5), jitter(vel[1], noiseScale * 0.5)]
          : [...vel])
        : [0, 0],
      ori: frame.orientations[id] ?? 0,
      team: info.team,
      role: info.position,
    }
  }

  return {
    gameId: play.gameId,
    playId: play.playId,
    frameId: frame.id,
    horizon: HORIZON,
    state,
    players: play.players as any,
  }
}

/** Determine outcome bucket from a simulated play's final ball position */
function classifyOutcome(
  simResult: CanonicalPlay,
  lineOfScrimmage: number,
): { yards: number; bucket: keyof OutcomeDistribution } {
  const lastFrame = simResult.frames[simResult.frames.length - 1]
  if (!lastFrame) return { yards: 0, bucket: 'short' }

  const ballPos = lastFrame.positions['ball']
  let finalX: number

  if (ballPos) {
    finalX = ballPos[0]
  } else {
    const xs = Object.values(lastFrame.positions).map((p) => p[0])
    finalX = xs.reduce((a, b) => a + b, 0) / xs.length
  }

  const yards = finalX - lineOfScrimmage

  if (finalX >= 110) return { yards, bucket: 'touchdown' }
  if (yards < 0) return { yards, bucket: 'loss' }
  if (yards < 5) return { yards, bucket: 'short' }
  if (yards < 10) return { yards, bucket: 'medium' }
  if (yards < 20) return { yards, bucket: 'long' }
  return { yards, bucket: 'explosive' }
}

/** Compute KL divergence between two distributions (with smoothing) */
function klDivergence(p: OutcomeDistribution, q: OutcomeDistribution): number {
  const keys: (keyof OutcomeDistribution)[] = ['loss', 'short', 'medium', 'long', 'explosive', 'touchdown']
  const eps = 1e-6
  let kl = 0
  for (const k of keys) {
    const pk = Math.max(p[k], eps)
    const qk = Math.max(q[k], eps)
    kl += pk * Math.log(pk / qk)
  }
  return Math.max(0, kl)
}

/** Compute separation stats for a player */
function computeSeparation(
  play: CanonicalPlay,
  playerId: string,
  frameIdx: number,
): { separation: number } | null {
  const frame = play.frames[frameIdx]
  const pos = frame.positions[playerId]
  if (!pos) return null

  const playerTeam = play.players[playerId]?.team
  if (!playerTeam) return null

  let minDist = Infinity
  for (const [otherId, otherInfo] of Object.entries(play.players)) {
    if (otherId === playerId || otherId === 'ball') continue
    if (otherInfo.team === playerTeam) continue
    const otherPos = frame.positions[otherId]
    if (!otherPos) continue
    const dx = pos[0] - otherPos[0]
    const dy = pos[1] - otherPos[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) minDist = dist
  }

  return minDist === Infinity ? null : { separation: Math.round(minDist * 100) / 100 }
}

/**
 * Compute per-player mean trajectory + variance from an array of sim results.
 */
function computePosteriorTrajectories(
  results: CanonicalPlay[],
  playerIds: string[],
): PosteriorTrajectory[] {
  if (results.length === 0) return []
  const horizonLen = results[0].frames.length

  return playerIds.map((pid) => {
    const meanPath: Array<[number, number]> = []
    const variance: number[] = []

    for (let fi = 0; fi < horizonLen; fi++) {
      let sumX = 0, sumY = 0, count = 0
      const xs: number[] = []
      const ys: number[] = []

      for (const result of results) {
        const frame = result.frames[fi]
        const pos = frame?.positions[pid]
        if (!pos) continue
        sumX += pos[0]
        sumY += pos[1]
        xs.push(pos[0])
        ys.push(pos[1])
        count++
      }

      if (count === 0) {
        meanPath.push([0, 0])
        variance.push(0)
        continue
      }

      const mx = sumX / count
      const my = sumY / count
      meanPath.push([Math.round(mx * 100) / 100, Math.round(my * 100) / 100])

      // Variance = average squared distance from mean
      let varSum = 0
      for (let i = 0; i < count; i++) {
        varSum += (xs[i] - mx) ** 2 + (ys[i] - my) ** 2
      }
      variance.push(Math.round((varSum / count) * 100) / 100)
    }

    return { playerId: pid, meanPath, variance }
  })
}

/**
 * Main belief engine: computes full play stats using forward simulation.
 * @param pauseFrame Optional frame index to compute posterior trajectories from
 */
export async function computePlayStats(
  play: CanonicalPlay,
  simulator: ForwardSimulator,
  pauseFrame?: number,
): Promise<PlayStats> {
  const lineOfScrimmage = estimateLineOfScrimmage(play)
  const posteriors: FramePosterior[] = []
  const playerStats: PlayerFrameStats[] = []
  let posteriorTrajectories: PosteriorTrajectory[] | undefined

  // Compute posteriors for each frame
  for (let fi = 0; fi < play.frames.length; fi++) {
    const distribution: OutcomeDistribution = {
      loss: 0, short: 0, medium: 0, long: 0, explosive: 0, touchdown: 0,
    }
    let totalYards = 0

    // Run N simulations in parallel with jittered initial conditions
    const simInputs = Array.from({ length: NUM_SIMS }, () => buildSimInput(play, fi, 0.3))
    const results = await Promise.all(simInputs.map(input => simulator.predict(input)))

    for (const result of results) {
      const outcome = classifyOutcome(result, lineOfScrimmage)
      distribution[outcome.bucket] += 1 / NUM_SIMS
      totalYards += outcome.yards
    }

    posteriors.push({
      frameId: play.frames[fi].id,
      pTouchdown: distribution.touchdown,
      pTurnover: distribution.loss * 0.1, // rough proxy
      expectedYards: Math.round((totalYards / NUM_SIMS) * 10) / 10,
      distribution,
    })

    // Compute posterior trajectories at the pause frame
    if (pauseFrame != null && fi === pauseFrame) {
      const playerIds = Object.keys(play.players).filter(id => id !== 'ball')
      posteriorTrajectories = computePosteriorTrajectories(results, playerIds)
    }

    // Compute per-player separation stats
    for (const [pid, info] of Object.entries(play.players)) {
      if (pid === 'ball') continue
      const sep = computeSeparation(play, pid, fi)
      if (sep) {
        playerStats.push({
          playerId: pid,
          frameId: play.frames[fi].id,
          separation: sep.separation,
        })
      }
    }
  }

  // Compute belief deltas
  const deltas: BeliefDelta[] = []
  for (let i = 1; i < posteriors.length; i++) {
    const kl = klDivergence(posteriors[i].distribution, posteriors[i - 1].distribution)
    deltas.push({
      frameId: posteriors[i].frameId,
      deltaPTd: posteriors[i].pTouchdown - posteriors[i - 1].pTouchdown,
      klDivergence: Math.round(kl * 10000) / 10000,
      isPivotal: kl > KL_PIVOT_THRESHOLD,
    })
  }

  // Identify top pivotal frames
  const sortedDeltas = [...deltas].sort((a, b) => b.klDivergence - a.klDivergence)
  const pivotalFrames = sortedDeltas.slice(0, TOP_PIVOTAL).map((d) => d.frameId)

  // Compute attributions for pivotal frames
  const attributions: PlayerAttribution[] = []
  for (const pivotFrameId of pivotalFrames) {
    const fi = play.frames.findIndex((f) => f.id === pivotFrameId)
    if (fi < 0) continue

    const baseInput = buildSimInput(play, fi, 0)
    const basePosterior = posteriors[fi]

    // For each player, simulate counterfactual (player frozen at t-1 position)
    for (const [pid, info] of Object.entries(play.players)) {
      if (pid === 'ball') continue
      // At frame 0 there's no previous frame for counterfactual — skip
      if (fi === 0) continue
      const prevPos = play.frames[fi - 1].positions[pid]
      if (!prevPos) continue

      const cfInput = { ...baseInput, state: { ...baseInput.state } }
      if (cfInput.state[pid]) {
        cfInput.state[pid] = { ...cfInput.state[pid], pos: [...prevPos] as [number, number] }
      }

      // Run counterfactual sims in parallel
      const cfSims = 10
      const cfInputs = Array.from({ length: cfSims }, () => cfInput)
      const cfResults = await Promise.all(cfInputs.map(input => simulator.predict(input)))

      const cfDist: OutcomeDistribution = {
        loss: 0, short: 0, medium: 0, long: 0, explosive: 0, touchdown: 0,
      }
      for (const result of cfResults) {
        const outcome = classifyOutcome(result, lineOfScrimmage)
        cfDist[outcome.bucket] += 1 / cfSims
      }

      const score = klDivergence(basePosterior.distribution, cfDist)
      if (score > 0.001) {
        attributions.push({
          playerId: pid,
          frameId: pivotFrameId,
          attributionScore: Math.round(score * 10000) / 10000,
          isPositive: info.team === (play.meta?.offense ?? 'home'),
        })
      }
    }
  }

  return { posteriors, deltas, attributions, playerStats, pivotalFrames, posteriorTrajectories }
}

/** Estimate line of scrimmage from first frame ball position or average offense x */
function estimateLineOfScrimmage(play: CanonicalPlay): number {
  const firstFrame = play.frames[0]
  if (!firstFrame) return 55

  const ballPos = firstFrame.positions['ball']
  if (ballPos) return ballPos[0]

  // Average offense x positions — use metadata if available, else guess offense
  // as the team with lower average X (closer to their own endzone, attacking toward x=120)
  let offenseTeam = play.meta?.offense
  if (!offenseTeam) {
    const teamXs: Record<string, number[]> = {}
    for (const [id, info] of Object.entries(play.players)) {
      if (id === 'ball') continue
      const pos = firstFrame.positions[id]
      if (!pos) continue
      if (!teamXs[info.team]) teamXs[info.team] = []
      teamXs[info.team].push(pos[0])
    }
    const teamAvgs = Object.entries(teamXs).map(([t, xs]) => ({
      team: t,
      avg: xs.reduce((a, b) => a + b, 0) / xs.length,
    }))
    teamAvgs.sort((a, b) => a.avg - b.avg)
    offenseTeam = teamAvgs[0]?.team ?? 'home'
  }
  const offenseXs: number[] = []
  for (const [id, info] of Object.entries(play.players)) {
    if (info.team === offenseTeam && firstFrame.positions[id]) {
      offenseXs.push(firstFrame.positions[id][0])
    }
  }
  return offenseXs.length > 0
    ? offenseXs.reduce((a, b) => a + b, 0) / offenseXs.length
    : 55
}
