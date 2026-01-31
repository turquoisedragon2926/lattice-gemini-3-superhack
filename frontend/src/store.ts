import { create } from 'zustand'
import type { PlayData, CameraMode, Stats, PlayStats } from './types'
import { predict, fetchPlayStats } from './api'

interface LatticeStore {
  // Data
  currentPlay: PlayData | null
  availablePlays: Array<{ gameId: number; playId: number; label: string }>

  // Playback
  currentFrame: number
  playing: boolean
  looping: boolean
  playbackSpeed: number

  // Camera
  cameraMode: CameraMode

  // Predictions (stubbed for future)
  predictions: PlayData | null

  // Stats
  stats: Stats
  statsOverlay: boolean
  playStats: PlayStats | null
  selectedPlayer: string | null

  // Fork simulation
  dragOverrides: Record<string, [number, number]>
  predictedPlay: PlayData | null
  simulating: boolean
  forkFrame: number | null
  simEngine: 'mock' | 'gemini'

  // Belief engine
  beliefEngineRunning: boolean
  beliefEngineResult: PlayStats | null

  // Actions
  loadPlay: (play: PlayData) => void
  setFrame: (n: number) => void
  tick: () => void
  play: () => void
  pause: () => void
  toggleLoop: () => void
  togglePlay: () => void
  setCameraMode: (mode: CameraMode) => void
  setPredictions: (p: PlayData | null) => void
  toggleStatsOverlay: () => void
  setPlayStats: (s: PlayStats | null) => void
  setSelectedPlayer: (id: string | null) => void
  setDragOverride: (playerId: string, pos: [number, number]) => void
  clearFork: () => void
  setSimEngine: (e: 'mock' | 'gemini') => void
  runSimulation: () => Promise<void>
  runBeliefEngine: () => Promise<void>
  clearBeliefEngine: () => void
}

export const useStore = create<LatticeStore>((set, get) => ({
  currentPlay: null,
  availablePlays: [],
  currentFrame: 0,
  playing: false,
  looping: true,
  playbackSpeed: 1.0,
  cameraMode: '3d',
  predictions: null,
  stats: { expectedYards: 0, separation: 0, endzoneProb: 0 },
  statsOverlay: false,
  playStats: null,
  selectedPlayer: null,
  dragOverrides: {},
  predictedPlay: null,
  simulating: false,
  forkFrame: null,
  simEngine: 'mock',
  beliefEngineRunning: false,
  beliefEngineResult: null,

  loadPlay: (play) => set({
    currentPlay: play,
    currentFrame: 0,
    playing: false,
    predictions: null,
    playStats: null,
    selectedPlayer: null,
  }),

  setFrame: (n) => {
    const play = get().currentPlay
    if (!play) return
    set({ currentFrame: Math.max(0, Math.min(n, play.frames.length - 1)) })
  },

  tick: () => {
    const { currentPlay, currentFrame, looping, playStats } = get()
    if (!currentPlay) return
    const maxFrame = currentPlay.frames.length - 1
    if (currentFrame >= maxFrame) {
      if (looping) {
        set({ currentFrame: 0 })
      } else {
        set({ playing: false })
      }
    } else {
      const nextFrame = currentFrame + 1
      // Update live stats from playStats if available
      const updates: Partial<LatticeStore> = { currentFrame: nextFrame }
      if (playStats && playStats.posteriors[nextFrame]) {
        const p = playStats.posteriors[nextFrame]
        updates.stats = {
          expectedYards: p.expectedYards,
          separation: 0,
          endzoneProb: p.pTouchdown,
        }
      }
      set(updates as any)
    }
  },

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  toggleLoop: () => set((s) => ({ looping: !s.looping })),
  setCameraMode: (mode) => {
    if (mode === 'ego' && !get().selectedPlayer) return
    set({ cameraMode: mode })
  },
  setPredictions: (p) => set({ predictions: p }),
  toggleStatsOverlay: () => set((s) => ({ statsOverlay: !s.statsOverlay })),
  setPlayStats: (s) => set({ playStats: s }),
  setSelectedPlayer: (id) => set((s) => {
    const newId = s.selectedPlayer === id ? null : id
    const updates: Partial<LatticeStore> = { selectedPlayer: newId }
    if (!newId && s.cameraMode === 'ego') updates.cameraMode = '3d'
    return updates as any
  }),

  setDragOverride: (playerId, pos) => {
    const { currentPlay, currentFrame } = get()
    if (!currentPlay) return
    const frame = currentPlay.frames[currentFrame]
    const original = frame?.positions[playerId]
    if (!original) return
    const maxDist = playerId === 'ball' ? 40 : 10
    const dx = pos[0] - original[0]
    const dy = pos[1] - original[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) return
    const clamped: [number, number] = dist > maxDist
      ? [original[0] + (dx / dist) * maxDist, original[1] + (dy / dist) * maxDist]
      : pos
    set((s) => ({ dragOverrides: { ...s.dragOverrides, [playerId]: clamped } }))
  },

  clearFork: () => {
    const forkFrame = get().forkFrame
    set({ dragOverrides: {}, predictedPlay: null, forkFrame: null, currentFrame: forkFrame ?? get().currentFrame })
  },

  setSimEngine: (e) => set({ simEngine: e }),

  runSimulation: async () => {
    const { currentPlay, currentFrame, dragOverrides, simEngine } = get()
    if (!currentPlay) return
    set({ simulating: true, forkFrame: currentFrame })
    const frame = currentPlay.frames[currentFrame]
    const state: Record<string, { pos: [number, number]; vel: [number, number]; ori: number; team: string }> = {}
    for (const [id, player] of Object.entries(currentPlay.players)) {
      const pos = dragOverrides[id] || frame.positions[id]
      const vel = frame.velocities[id] || [0, 0]
      const ori = frame.orientations[id] ?? 0
      if (!pos) continue
      state[id] = { pos, vel, ori, team: player.team }
    }
    try {
      const result = await predict({
        gameId: currentPlay.gameId,
        playId: currentPlay.playId,
        frameId: frame.id,
        horizon: 20,
        state,
        players: currentPlay.players,
        simulator: simEngine,
      })
      set({ predictedPlay: result, simulating: false })
    } catch {
      set({ simulating: false })
    }
  },
}))
