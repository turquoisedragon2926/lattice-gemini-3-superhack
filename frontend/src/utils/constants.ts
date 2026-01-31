// Field dimensions in yards
export const FIELD_LENGTH = 120 // including endzones
export const FIELD_WIDTH = 53.3
export const ENDZONE_DEPTH = 10

// Scene coordinates: origin at field center
export const FIELD_HALF_LENGTH = FIELD_LENGTH / 2 // 60
export const FIELD_HALF_WIDTH = FIELD_WIDTH / 2 // 26.65

// NFL hash mark positions (yards from nearest sideline)
export const HASH_FROM_SIDELINE = 23.583 // NFL standard
export const HASH_Y_LEFT = HASH_FROM_SIDELINE - FIELD_HALF_WIDTH // scene z
export const HASH_Y_RIGHT = FIELD_HALF_WIDTH - HASH_FROM_SIDELINE

// Colors
export const CYAN = '#00e5ff'
export const WHITE = '#e0e0e0'
export const CYAN_HEX = 0x00e5ff
export const WHITE_HEX = 0xe0e0e0
export const ORANGE_ACCENT = '#ff6b35'

// Opacity
export const SUBGRID_OPACITY = 0.06
export const YARD_LINE_OPACITY = 0.4
export const BOUNDARY_OPACITY = 0.7
export const HASH_OPACITY = 0.25

// Camera
export const PERSPECTIVE_POSITION: [number, number, number] = [0, 45, 55]
export const AUTO_ROTATE_SPEED = 0.3
export const IDLE_TIMEOUT_MS = 8000

// Playback
export const FRAME_INTERVAL = 0.1 // 10 Hz

// Convert data coords to scene coords
export function toScene(x: number, y: number): [number, number, number] {
  return [x - FIELD_HALF_LENGTH, 0, y - FIELD_HALF_WIDTH]
}
