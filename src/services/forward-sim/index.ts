export type { ForwardSimulator } from '../types.js'
import type { ForwardSimulator } from '../types.js'
import { MockForwardSimulator } from './mock.js'
import { GeminiForwardSimulator } from './gemini.js'

export function createForwardSimulator(type: 'mock' | 'gemini' = 'mock'): ForwardSimulator {
  switch (type) {
    case 'mock':
      return new MockForwardSimulator()
    case 'gemini':
      return new GeminiForwardSimulator()
    default:
      throw new Error(`Unknown simulator type: ${type}`)
  }
}

export { MockForwardSimulator } from './mock.js'
export { GeminiForwardSimulator } from './gemini.js'
