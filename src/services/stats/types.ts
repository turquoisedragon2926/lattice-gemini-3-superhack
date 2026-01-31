// Stats engine types

/** Outcome distribution bucketed by yards gained */
export interface OutcomeDistribution {
  /** Fraction of sims in each bucket */
  loss: number       // < 0 yards
  short: number      // 0-5 yards
  medium: number     // 5-10 yards
  long: number       // 10-20 yards
  explosive: number  // 20+ yards
  touchdown: number  // reached endzone
}

/** Posterior belief state at a single frame */
export interface FramePosterior {
  frameId: number
  pTouchdown: number
  pTurnover: number
  expectedYards: number
  distribution: OutcomeDistribution
}

/** Belief shift between consecutive frames */
export interface BeliefDelta {
  frameId: number
  deltaPTd: number
  klDivergence: number
  isPivotal: boolean  // KL exceeds threshold
}

/** Per-player attribution for a single frame */
export interface PlayerAttribution {
  playerId: string
  frameId: number
  attributionScore: number  // KL contribution
  isPositive: boolean       // helped offense?
}

/** Role-specific stats for a player at a frame */
export interface PlayerFrameStats {
  playerId: string
  frameId: number
  separation?: number          // distance to nearest opponent
  separationConfLow?: number   // lower confidence band
  separationConfHigh?: number  // upper confidence band
  windowProb?: number          // WR: % of sims with ≥2yd separation
  pressureClock?: number       // QB: P(sack within 10 frames)
  expectedYardsRemaining?: number // ball carrier
}

/** Mean + variance per player per predicted frame (for posterior visualization) */
export interface PosteriorTrajectory {
  playerId: string
  /** Mean positions across all sims, one per horizon frame */
  meanPath: Array<[number, number]>
  /** Variance (spread) at each horizon frame — drives glow width */
  variance: number[]
}

/** Full stats package for an entire play */
export interface PlayStats {
  posteriors: FramePosterior[]
  deltas: BeliefDelta[]
  attributions: PlayerAttribution[]  // only for pivotal frames
  playerStats: PlayerFrameStats[]
  pivotalFrames: number[]  // frame IDs with highest KL
  /** Per-player posterior trajectories from the pause frame */
  posteriorTrajectories?: PosteriorTrajectory[]
}
