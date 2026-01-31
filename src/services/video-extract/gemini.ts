import { GoogleGenAI } from '@google/genai'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { VideoExtractor, VideoInput, CanonicalPlay } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPT = readFileSync(resolve(__dirname, '../../../prompts/video-extract.md'), 'utf-8')

// Few-shot example: model response for CIN@NE play (used as demonstration)
const FEW_SHOT_EXAMPLE = JSON.stringify({
  gameId: '2016_06_CIN_NE',
  playId: 1,
  meta: {
    quarter: 2, down: 2, yardsToGo: 6,
    offense: 'NE', defense: 'CIN',
    description: 'Tom Brady pass short right to Julian Edelman for 8 yards to the NE 41.',
  },
  frameCount: 10,
  events: { ball_snap: 1, pass_forward: 4, pass_outcome_caught: 6, tackle: 8 },
  players: {
    v_1: { name: 'Tom Brady', team: 'home', jersey: 12, position: 'QB' },
    v_2: { name: 'James White', team: 'home', jersey: 28, position: 'RB' },
    v_3: { name: 'Julian Edelman', team: 'home', jersey: 11, position: 'WR' },
    v_4: { name: 'Rob Gronkowski', team: 'home', jersey: 87, position: 'TE' },
    v_5: { name: 'Chris Hogan', team: 'home', jersey: 15, position: 'WR' },
    v_6: { name: 'David Andrews', team: 'home', jersey: 60, position: 'C' },
    v_7: { name: 'Joe Thuney', team: 'home', jersey: 62, position: 'LG' },
    v_8: { name: 'Shaq Mason', team: 'home', jersey: 69, position: 'RG' },
    v_9: { name: 'Nate Solder', team: 'home', jersey: 77, position: 'LT' },
    v_10: { name: 'Marcus Cannon', team: 'home', jersey: 61, position: 'RT' },
    v_11: { name: 'Malcolm Mitchell', team: 'home', jersey: 19, position: 'WR' },
    v_12: { name: 'Geno Atkins', team: 'away', jersey: 97, position: 'DT' },
    v_13: { name: 'Domata Peko', team: 'away', jersey: 94, position: 'NT' },
    v_14: { name: 'Carlos Dunlap', team: 'away', jersey: 96, position: 'DE' },
    v_15: { name: 'Wallace Gilberry', team: 'away', jersey: 95, position: 'DE' },
    v_16: { name: 'Vontaze Burfict', team: 'away', jersey: 55, position: 'LB' },
    v_17: { name: 'Karlos Dansby', team: 'away', jersey: 58, position: 'LB' },
    v_18: { name: 'Vincent Rey', team: 'away', jersey: 57, position: 'LB' },
    v_19: { name: 'Adam Jones', team: 'away', jersey: 24, position: 'CB' },
    v_20: { name: 'Dre Kirkpatrick', team: 'away', jersey: 27, position: 'CB' },
    v_21: { name: 'Shawn Williams', team: 'away', jersey: 36, position: 'S' },
    v_22: { name: 'George Iloka', team: 'away', jersey: 43, position: 'S' },
  },
  frames: [
    { id: 1, positions: { v_1: [38.0, 26.7], v_2: [38.0, 30.3], v_3: [42.5, 8.3], v_4: [43.0, 43.3], v_5: [43.0, 5.3], v_6: [43.0, 26.7], v_7: [43.0, 28.8], v_8: [43.0, 24.4], v_9: [43.0, 31.3], v_10: [43.0, 21.9], v_11: [42.5, 13.3], v_12: [44.0, 27.5], v_13: [44.0, 26.0], v_14: [44.0, 22.3], v_15: [44.0, 31.3], v_16: [47.0, 25.3], v_17: [47.0, 30.3], v_18: [48.0, 18.3], v_19: [48.0, 5.3], v_20: [50.0, 43.3], v_21: [55.0, 21.3], v_22: [58.0, 33.3], ball: [43.0, 26.7] }, orientations: { v_1: 0, v_3: 0, v_16: 180, v_17: 180 } },
    { id: 2, positions: { v_1: [35.5, 26.7], v_3: [44.2, 8.0], v_16: [46.5, 24.8], ball: [35.5, 26.7] }, orientations: { v_1: 0, v_3: 0 } },
    { id: 3, positions: { v_1: [34.8, 26.7], v_3: [46.0, 7.8], v_16: [46.2, 24.0], ball: [34.8, 26.7] }, orientations: { v_1: 15, v_3: 45 } },
    { id: 4, positions: { v_1: [35.0, 26.7], v_3: [47.5, 8.2], v_16: [46.5, 22.0], ball: [36.0, 25.0] }, orientations: { v_1: 30, v_3: 90 } },
    { id: 5, positions: { v_1: [35.2, 26.8], v_3: [48.5, 8.8], v_16: [47.5, 18.0], ball: [42.0, 15.0] }, orientations: { v_1: 30, v_3: 120 } },
    { id: 6, positions: { v_1: [35.5, 26.9], v_3: [49.5, 9.5], v_16: [48.5, 14.0], ball: [49.5, 9.5] }, orientations: { v_3: 45, v_17: 225 } },
    { id: 7, positions: { v_3: [50.2, 10.2], v_16: [49.5, 11.5], v_17: [49.8, 11.0], ball: [50.2, 10.2] }, orientations: { v_3: 0, v_17: 270 } },
    { id: 8, positions: { v_3: [50.8, 10.8], v_16: [50.4, 11.0], v_17: [50.6, 11.0], ball: [50.8, 10.8] }, orientations: { v_3: 30, v_16: 270 } },
    { id: 9, positions: { v_3: [51.0, 11.0], v_16: [50.8, 11.0], v_17: [50.9, 11.0], ball: [51.0, 11.0] }, orientations: { v_3: 90 } },
    { id: 10, positions: { v_3: [51.0, 11.0], v_16: [51.0, 11.0], v_17: [51.0, 11.0], ball: [51.0, 11.0] }, orientations: { v_3: 90 } },
  ],
  source: 'video',
}, null, 2)

export class GeminiVideoExtractor implements VideoExtractor {
  private client: GoogleGenAI | null = null

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required')
      this.client = new GoogleGenAI({ apiKey })
    }
    return this.client
  }

  async extract(input: VideoInput): Promise<CanonicalPlay> {
    // Build the user part: video/image + prompt
    const userParts: Array<Record<string, unknown>> = []

    if (input.url) {
      userParts.push({
        fileData: { fileUri: input.url, mimeType: input.type === 'video' ? 'video/*' : 'image/*' },
      })
    } else if (input.base64) {
      userParts.push({
        inlineData: { data: input.base64, mimeType: input.type === 'video' ? 'video/mp4' : 'image/jpeg' },
      })
    }

    userParts.push({ text: PROMPT })

    const response = await this.getClient().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        // Few-shot example: demo video + prompt → expected output
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: 'https://www.youtube.com/watch?v=JfVGoNf6gtI', mimeType: 'video/*' } },
            { text: PROMPT },
          ],
        },
        {
          role: 'model',
          parts: [{ text: '```json\n' + FEW_SHOT_EXAMPLE + '\n```' }],
        },
        // Actual request
        { role: 'user', parts: userParts },
      ],
      config: {
        thinkingConfig: { thinkingLevel: 'HIGH' as any },
        tools: [{ googleSearch: {} }],
      },
    })

    // Extract JSON from response
    const text = response.text ?? ''
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error('Gemini response did not contain valid JSON')

    const parsed = JSON.parse(jsonMatch[1])

    // Normalize to canonical format: ensure velocities exist on each frame, events as strings
    const frames = parsed.frames.map((f: any) => ({
      id: f.id,
      positions: f.positions,
      velocities: f.velocities ?? {},
      orientations: f.orientations ?? {},
    }))

    const events: Record<string, string> = {}
    if (parsed.events) {
      for (const [k, v] of Object.entries(parsed.events)) {
        events[k] = String(v)
      }
    }

    return {
      gameId: null,
      playId: null,
      meta: parsed.meta,
      frameCount: parsed.frameCount ?? frames.length,
      events,
      players: parsed.players,
      frames,
      source: 'video',
    }
  }
}
