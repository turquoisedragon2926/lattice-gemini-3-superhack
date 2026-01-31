import { Router } from 'express'
import { createVideoExtractor } from '../../../src/services/video-extract/index.js'

export const extractRouter = Router()

// Use 'mock' or 'gemini' based on query param ?source=gemini (default: mock)
extractRouter.post('/', async (req, res) => {
  const source = (req.query.source as string) === 'gemini' ? 'gemini' : 'mock'
  try {
    const extractor = createVideoExtractor(source)
    const result = await extractor.extract(req.body)
    res.json(result)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})
