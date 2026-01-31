import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'lattice.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true })
    db.pragma('cache_size = -500000') // ~500MB
  }
  return db
}

// Prepared statements for hot queries

export function getGames(season?: number, week?: number) {
  const db = getDb()
  if (season && week) {
    return db.prepare(
      'SELECT game_id, season, week, game_date, home_team, away_team, home_score, away_score FROM games WHERE season = ? AND week = ? ORDER BY game_date'
    ).all(season, week)
  }
  if (season) {
    return db.prepare(
      'SELECT game_id, season, week, game_date, home_team, away_team, home_score, away_score FROM games WHERE season = ? ORDER BY week, game_date'
    ).all(season)
  }
  return db.prepare(
    'SELECT game_id, season, week, game_date, home_team, away_team, home_score, away_score FROM games ORDER BY season, week, game_date'
  ).all()
}

export function getPlaysForGame(gameId: number) {
  const db = getDb()
  return db.prepare(
    'SELECT play_id, quarter, down, yards_to_go, offense_team, defense_team, play_result, description, frame_count FROM plays WHERE game_id = ? ORDER BY play_id'
  ).all(gameId)
}

export function getPlayData(gameId: number, playId: number) {
  const db = getDb()

  // Get play metadata
  const play = db.prepare(
    'SELECT * FROM plays WHERE game_id = ? AND play_id = ?'
  ).get(gameId, playId) as any

  if (!play) return null

  // Get all frame rows for this play
  const frameRows = db.prepare(
    'SELECT * FROM frames WHERE game_id = ? AND play_id = ? ORDER BY frame_id, nfl_id'
  ).all(gameId, playId) as any[]

  if (frameRows.length === 0) return null

  // Pre-fetch all player positions to avoid N+1 queries
  const nflIds = [...new Set(frameRows.filter(r => r.nfl_id != null).map(r => r.nfl_id))]
  const positionMap: Record<number, string> = {}
  if (nflIds.length > 0) {
    const placeholders = nflIds.map(() => '?').join(',')
    const playerRows = db.prepare(`SELECT nfl_id, position FROM players WHERE nfl_id IN (${placeholders})`).all(...nflIds) as any[]
    for (const p of playerRows) {
      positionMap[p.nfl_id] = p.position
    }
  }

  // Build players map and frames array
  const players: Record<string, any> = {}
  const eventsMap: Record<string, string> = {}
  const framesMap = new Map<number, { positions: Record<string, [number, number]>; velocities: Record<string, [number, number]>; orientations: Record<string, number> }>()

  for (const row of frameRows) {
    const playerId = row.nfl_id == null || row.nfl_id === -1 ? 'ball' : String(row.nfl_id)

    // Build player identity (deduplicated)
    if (!players[playerId]) {
      players[playerId] = {
        name: row.display_name || (row.team === 'ball' ? 'Football' : 'Unknown'),
        team: row.team || 'unknown',
        ...(row.jersey_number != null && { jersey: row.jersey_number }),
      }
      if (row.nfl_id != null && positionMap[row.nfl_id]) {
        players[playerId].position = positionMap[row.nfl_id]
      }
    }

    // Track events
    if (row.event) {
      eventsMap[String(row.frame_id)] = row.event
    }

    // Build frame data
    if (!framesMap.has(row.frame_id)) {
      framesMap.set(row.frame_id, { positions: {}, velocities: {}, orientations: {} })
    }
    const frame = framesMap.get(row.frame_id)!
    frame.positions[playerId] = [row.x, row.y]
    if (row.vx != null && row.vy != null) {
      frame.velocities[playerId] = [row.vx, row.vy]
    }
    if (row.orientation != null) {
      frame.orientations[playerId] = row.orientation
    }
  }

  // Convert to sorted array
  const frames = Array.from(framesMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, data]) => ({ id, ...data }))

  return {
    gameId,
    playId,
    meta: {
      quarter: play.quarter,
      down: play.down,
      yardsToGo: play.yards_to_go,
      offense: play.offense_team,
      defense: play.defense_team,
      description: play.description,
    },
    frameCount: frames.length,
    events: eventsMap,
    players,
    frames,
    source: 'kaggle' as const,
  }
}

export function getPlayer(nflId: number) {
  const db = getDb()
  return db.prepare('SELECT * FROM players WHERE nfl_id = ?').get(nflId)
}
