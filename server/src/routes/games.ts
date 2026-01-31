import { Router } from 'express'
import { getGames } from '../db.js'

export const gamesRouter = Router()

gamesRouter.get('/', (req, res) => {
  const season = req.query.season ? Number(req.query.season) : undefined
  const week = req.query.week ? Number(req.query.week) : undefined
  res.json(getGames(season, week))
})
