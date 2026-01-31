import { useState } from 'react'
import { useStore } from '../store'
import { extractVideo } from '../api'
import { useFunModeStore } from '../funmode/funModeStore'
import styles from './Controls.module.css'

type DataSource = 'dataset' | 'mock' | 'gemini'

export function Controls() {
  const funPhase = useFunModeStore((s) => s.funPhase)
  const enterFunMode = useFunModeStore((s) => s.enterFunMode)

  // Hide normal controls when fun mode is active
  if (funPhase !== 'idle') return null
  const playing = useStore((s) => s.playing)
  const looping = useStore((s) => s.looping)
  const currentFrame = useStore((s) => s.currentFrame)
  const currentPlay = useStore((s) => s.currentPlay)
  const cameraMode = useStore((s) => s.cameraMode)
  const statsOverlay = useStore((s) => s.statsOverlay)
  const selectedPlayer = useStore((s) => s.selectedPlayer)
  const dragOverrides = useStore((s) => s.dragOverrides)
  const predictedPlay = useStore((s) => s.predictedPlay)
  const simulating = useStore((s) => s.simulating)
  const simEngine = useStore((s) => s.simEngine)
  const setSimEngine = useStore((s) => s.setSimEngine)
  const togglePlay = useStore((s) => s.togglePlay)
  const toggleLoop = useStore((s) => s.toggleLoop)
  const setFrame = useStore((s) => s.setFrame)
  const setCameraMode = useStore((s) => s.setCameraMode)
  const toggleStatsOverlay = useStore((s) => s.toggleStatsOverlay)
  const runSimulation = useStore((s) => s.runSimulation)
  const clearFork = useStore((s) => s.clearFork)

  const loadPlay = useStore((s) => s.loadPlay)

  const [dataSource, setDataSource] = useState<DataSource>('dataset')
  const [loadingSource, setLoadingSource] = useState(false)

  const handleSourceChange = async (source: DataSource) => {
    if (source === dataSource) return
    setDataSource(source)
    if (source === 'mock') {
      setLoadingSource(true)
      try {
        const play = await extractVideo({ type: 'video' })
        loadPlay(play)
      } catch (e) {
        console.error('Failed to load mock extract:', e)
      } finally {
        setLoadingSource(false)
      }
    } else if (source === 'gemini') {
      const url = window.prompt('Enter YouTube URL or image URL:')
      if (!url) { setDataSource(dataSource); return }
      setLoadingSource(true)
      try {
        const isVideo = url.includes('youtube.com') || url.includes('youtu.be') || url.endsWith('.mp4')
        const play = await extractVideo({ type: isVideo ? 'video' : 'image', url }, 'gemini')
        loadPlay(play)
      } catch (e) {
        console.error('Gemini extract failed:', e)
        alert('Gemini extract failed. Is GEMINI_API_KEY set on the server?')
        setDataSource(dataSource)
      } finally {
        setLoadingSource(false)
      }
    }
    // 'dataset' — no action, keeps whatever play is currently loaded from the dataset
  }

  const totalFrames = currentPlay?.frames.length ?? 0

  return (
    <div className={styles.container}>
      {/* Data source toggle */}
      <div className={styles.group}>
        <button
          className={`${styles.btn} ${dataSource === 'dataset' ? styles.btnActive : ''}`}
          onClick={() => handleSourceChange('dataset')}
        >
          DATA
        </button>
        <button
          className={`${styles.btn} ${dataSource === 'mock' ? styles.btnActive : ''}`}
          onClick={() => handleSourceChange('mock')}
          disabled={loadingSource}
        >
          {loadingSource && dataSource === 'mock' ? 'LOAD…' : 'MOCK'}
        </button>
        <button
          className={`${styles.btn} ${dataSource === 'gemini' ? styles.btnActive : ''}`}
          onClick={() => handleSourceChange('gemini')}
          disabled={loadingSource}
          title="Extract play from YouTube video via Gemini"
        >
          {loadingSource && dataSource === 'gemini' ? 'LOAD…' : 'GEMINI'}
        </button>
      </div>

      <div className={styles.divider} />

      {/* Camera mode */}
      <div className={styles.group}>
        <button
          className={`${styles.btn} ${cameraMode === 'top' ? styles.btnActive : ''}`}
          onClick={() => setCameraMode('top')}
        >
          TOP
        </button>
        <button
          className={`${styles.btn} ${cameraMode === '3d' ? styles.btnActive : ''}`}
          onClick={() => setCameraMode('3d')}
        >
          3D
        </button>
        <button
          className={`${styles.btn} ${cameraMode === 'ego' ? styles.btnActive : ''}`}
          onClick={() => setCameraMode('ego')}
          disabled={!selectedPlayer}
          title={!selectedPlayer ? 'Select a player first' : 'First-person view'}
        >
          EGO
        </button>
      </div>

      <div className={styles.divider} />

      {/* Stats overlay toggle */}
      <div className={styles.group}>
        <button
          className={`${styles.btn} ${statsOverlay ? styles.btnActive : ''}`}
          onClick={toggleStatsOverlay}
        >
          STATS
        </button>
      </div>

      <div className={styles.divider} />

      {/* Playback controls */}
      <div className={styles.group}>
        <button className={styles.btn} onClick={togglePlay}>
          {playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          className={`${styles.btn} ${looping ? styles.btnActive : ''}`}
          onClick={toggleLoop}
        >
          LOOP
        </button>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        className={styles.scrubber}
        min={0}
        max={Math.max(0, totalFrames - 1)}
        value={currentFrame}
        onChange={(e) => setFrame(Number(e.target.value))}
      />

      <span className={styles.frameCount}>
        {currentFrame + 1} / {totalFrames}
      </span>

      <div className={styles.divider} />

      {/* Fun mode entry */}
      <div className={styles.group}>
        <button className={styles.btn} onClick={enterFunMode}>
          FUN
        </button>
      </div>

      {/* Fork simulation controls */}
      {!playing && (Object.keys(dragOverrides).length > 0 || predictedPlay) && (
        <>
          <div className={styles.divider} />
          <div className={styles.group}>
            <button
              className={`${styles.btn} ${simEngine === 'mock' ? styles.btnActive : ''}`}
              onClick={() => setSimEngine('mock')}
            >
              MOCK
            </button>
            <button
              className={`${styles.btn} ${simEngine === 'gemini' ? styles.btnActive : ''}`}
              onClick={() => setSimEngine('gemini')}
              title="Use Gemini AI for forward simulation"
            >
              GEMINI
            </button>
          </div>
        </>
      )}
      {!playing && Object.keys(dragOverrides).length > 0 && !predictedPlay && (
        <>
          <button
            className={styles.btn}
            onClick={runSimulation}
            disabled={simulating}
          >
            {simulating ? 'SIM...' : 'SIMULATE'}
          </button>
        </>
      )}
      {predictedPlay && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} onClick={clearFork}>
            CLEAR
          </button>
        </>
      )}
    </div>
  )
}
