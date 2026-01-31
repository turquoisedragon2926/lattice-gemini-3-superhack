import { Router } from 'express'
import { GeminiCameraPoseEstimator } from '../../../src/services/camera-pose/gemini.js'

export const cameraPoseRouter = Router()

cameraPoseRouter.post('/', async (req, res) => {
  const { base64 } = req.body
  if (!base64 || typeof base64 !== 'string') {
    return res.status(400).json({ error: 'base64 field is required' })
  }

  try {
    const estimator = new GeminiCameraPoseEstimator()
    const result = await estimator.estimate(base64)
    res.json(result)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})
