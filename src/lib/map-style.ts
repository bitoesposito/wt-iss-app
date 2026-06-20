// Costanti condivise per stile mappa, colori e parametri di tracking.
// Centralizzano i "magic number" prima sparsi tra i vari hook.

export type RgbaColor = readonly [number, number, number, number]

// Palette (allineata ai colori Tailwind usati nella UI).
export const ACTIVE_BLUE: RgbaColor = [59, 130, 246, 1]
export const LATEST_GREEN: RgbaColor = [34, 197, 94, 1]
export const MUTED_GRAY: RgbaColor = [156, 163, 175, 0.7]
export const MUTED_GRAY_3D: RgbaColor = [156, 163, 175, 0.6]
export const WHITE_OUTLINE: RgbaColor = [255, 255, 255, 1]
export const WHITE_OUTLINE_SOFT: RgbaColor = [255, 255, 255, 0.8]
export const TRACK_BLUE: RgbaColor = [59, 130, 246, 0.33]
export const BUFFER_FILL: RgbaColor = [59, 130, 246, 0.08]
export const BUFFER_OUTLINE: RgbaColor = [59, 130, 246, 0.6]

// Dimensioni marker (px).
export const MARKER_SIZE_ACTIVE = 12
export const MARKER_SIZE_LATEST = 12
export const MARKER_SIZE_MUTED = 8
export const MARKER_SIZE_SAT = 10
export const TRAIL_SIZE_DEFAULT_3D = 5
export const TRAIL_SIZE_ACTIVE_3D = 8

// Mappa / vista.
export const DEFAULT_ZOOM = 3
export const SAT_FOCUS_ZOOM = 4

// ISS.
export const DEFAULT_ISS_ALTITUDE_KM = 408
export const ISS_MODEL_HEIGHT_M = 300_000

// Tracce orbitali satelliti.
export const TRACK_WINDOW_MINUTES = 90
export const TRACK_STEP_SECONDS = 120

// Rendering asincrono: numero di satelliti elaborati per "chunk" prima di
// cedere il controllo al event-loop, così la UI resta reattiva con selezioni grandi.
export const SAT_RENDER_CHUNK_SIZE = 25
