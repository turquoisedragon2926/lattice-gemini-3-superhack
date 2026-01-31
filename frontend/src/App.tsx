import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from './store'
import { Field } from './scene/Field'
import { PlayerLayer } from './scene/PlayerLayer'
import { StatsOverlay } from './scene/StatsOverlay'
import { CameraRig } from './camera/CameraRig'
import { Effects } from './postprocessing/Effects'
import { PredictedPaths } from './scene/PredictedPaths'
import { StatsHUD } from './hud/StatsHUD'
import { Controls } from './hud/Controls'
import { FunModeOverlay } from './funmode/FunModeOverlay'
import { FunModeCamera } from './funmode/FunModeCamera'
import { samplePlay } from './data/samplePlay'
import { fetchGames, fetchPlays, fetchPlay, fetchPlayStats, extractVideo } from './api'
import { FRAME_INTERVAL } from './utils/constants'

function PlaybackEngine() {
  const accum = useRef(0)

  useFrame((_, delta) => {
    const { playing, playbackSpeed, tick } = useStore.getState()
    if (!playing) {
      accum.current = 0
      return
    }
    accum.current += delta * playbackSpeed
    while (accum.current >= FRAME_INTERVAL) {
      accum.current -= FRAME_INTERVAL
      tick()
    }
  })

  return null
}

/** Compute stats when a play is loaded and overlay is on */
function StatsLoader() {
  const currentPlay = useStore((s) => s.currentPlay)
  const statsOverlay = useStore((s) => s.statsOverlay)
  const playStats = useStore((s) => s.playStats)

  useEffect(() => {
    if (!currentPlay || !statsOverlay || playStats) return

    let cancelled = false
    const playRef = currentPlay
    async function load() {
      try {
        const stats = await fetchPlayStats(playRef)
        if (!cancelled && useStore.getState().currentPlay === playRef) {
          useStore.getState().setPlayStats(stats)
          // Set initial stats
          if (stats.posteriors.length > 0) {
            const p = stats.posteriors[0]
            useStore.setState({
              stats: {
                expectedYards: p.expectedYards,
                separation: 0,
                endzoneProb: p.pTouchdown,
              },
            })
          }
        }
      } catch {
        // Stats API not available — silent fail
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentPlay, statsOverlay, playStats])

  return null
}

export function App() {
  useEffect(() => {
    async function loadInitialPlay() {
      // Try loading mock Gemini extract first
      try {
        const play = await extractVideo({ type: 'video' }, 'mock')
        useStore.getState().loadPlay(play)
        return
      } catch {
        // Extract endpoint not available, try dataset
      }
      try {
        const games = await fetchGames()
        if (games.length > 0) {
          const gameId = games[0].game_id
          const plays = await fetchPlays(gameId)
          if (plays.length > 0) {
            const play = await fetchPlay(gameId, plays[0].play_id)
            useStore.getState().loadPlay(play)
            return
          }
        }
      } catch {
        // API not available, use sample
      }
      useStore.getState().loadPlay(samplePlay)
    }
    loadInitialPlay()
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ background: '#000' }}
      >
        <CameraRig />
        <FunModeCamera />
        <Field />
        <PlayerLayer />
        <StatsOverlay />
        <PredictedPaths />
        <PlaybackEngine />
        <Effects />
      </Canvas>
      <StatsHUD />
      <Controls />
      <FunModeOverlay />
      <StatsLoader />
    </div>
  )
}
