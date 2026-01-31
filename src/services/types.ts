// Canonical play format — matches contracts/data.md exactly

export interface CanonicalPlay {
  gameId: number | null
  playId: number | null
  meta?: PlayMeta
  frameCount: number
  events?: Record<string, string>
  players: Record<string, PlayerInfo>
  frames: Frame[]
  source: 'kaggle' | 'gemini' | 'mock' | 'video'
}

export interface PlayMeta {
  quarter?: number
  down?: number
  yardsToGo?: number
  offense?: string
  defense?: string
  description?: string
}

export interface PlayerInfo {
  name: string
  team: string
  jersey?: number
  position?: string
}

export interface Frame {
  id: number
  positions: Record<string, [number, number]>
  velocities: Record<string, [number, number]>
  orientations: Record<string, number>
}

// Forward simulation input — matches Gemini prompt contract in data.md

export interface SimulationInput {
  gameId: number | null
  playId: number | null
  frameId: number
  horizon: number
  state: Record<string, PlayerSnapshot>
  players: Record<string, PlayerInfo>
}

export interface PlayerSnapshot {
  pos: [number, number]
  vel: [number, number]
  ori: number
  team: string
  role?: string
}

// Video extractor input

export interface VideoInput {
  type: 'image' | 'video'
  url?: string
  base64?: string
}

// Service interfaces

export interface ForwardSimulator {
  predict(input: SimulationInput): Promise<CanonicalPlay>
}

export interface VideoExtractor {
  extract(input: VideoInput): Promise<CanonicalPlay>
}
