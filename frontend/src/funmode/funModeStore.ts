import { create } from 'zustand'

export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

export type FunPhase = 'idle' | 'uploading' | 'extracting' | 'revealing' | 'interactive'

interface FunModeStore {
  funPhase: FunPhase
  funImageDataUrl: string | null
  funCameraPose: CameraPose | null
  revealProgress: number
  error: string | null

  enterFunMode: () => void
  exitFunMode: () => void
  setFunImage: (dataUrl: string) => void
  setFunCameraPose: (pose: CameraPose) => void
  setFunPhase: (phase: FunPhase) => void
  setRevealProgress: (t: number) => void
  setError: (msg: string | null) => void
}

export const useFunModeStore = create<FunModeStore>((set) => ({
  funPhase: 'idle',
  funImageDataUrl: null,
  funCameraPose: null,
  revealProgress: 0,
  error: null,

  enterFunMode: () => set({
    funPhase: 'uploading',
    funImageDataUrl: null,
    funCameraPose: null,
    revealProgress: 0,
    error: null,
  }),

  exitFunMode: () => set({
    funPhase: 'idle',
    funImageDataUrl: null,
    funCameraPose: null,
    revealProgress: 0,
    error: null,
  }),

  setFunImage: (dataUrl) => set({ funImageDataUrl: dataUrl }),
  setFunCameraPose: (pose) => set({ funCameraPose: pose }),
  setFunPhase: (phase) => set({ funPhase: phase }),
  setRevealProgress: (t) => set({ revealProgress: t }),
  setError: (msg) => set({ error: msg }),
}))
