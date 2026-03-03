/**
 * Shared type definitions for Sequelize models.
 * Extracted from JSDoc typedefs scattered across model files.
 */

export interface FileMetadata {
  filename: string
  ext: string
  path: string
  relPath: string
  size: number
  mtimeMs: number
  ctimeMs: number
  birthtimeMs: number
}

export interface ChapterObject {
  id: number
  start: number
  end: number
  title: string
}

export interface AudioFileObject {
  index: number
  ino: string
  metadata: FileMetadata
  addedAt: number
  updatedAt: number
  trackNumFromMeta: number | null
  discNumFromMeta: number | null
  trackNumFromFilename: number | null
  discNumFromFilename: number | null
  manuallyVerified: boolean
  invalid: boolean
  exclude: boolean
  error: string | null
  format: string
  duration: number
  bitRate: number
  language: string | null
  codec: string
  timeBase: string
  channels: number
  channelLayout: string
  chapters: ChapterObject[]
  embeddedCoverArt: string | null
  metaTags: Record<string, string>
  mimeType: string
}

export interface AudioTrack {
  index: number
  startOffset: number
  duration: number
  title: string
  contentUrl: string
  mimeType: string
  codec: string | null
  metadata: FileMetadata | null
}

export interface EBookFileObject {
  ino: string
  metadata: FileMetadata
  ebookFormat: string
  addedAt: number
  updatedAt: number
}

export interface LibraryFileObject {
  ino: string
  metadata: FileMetadata
  isSupplementary: boolean | null
  addedAt: number
  updatedAt: number
  fileType: string
}

export interface AudioBookmarkObject {
  libraryItemId: string
  title: string
  time: number
  createdAt: number
}

export interface DeviceExtraData {
  manufacturer?: string
  model?: string
  osName?: string
  osVersion?: string
  browserName?: string
}

export interface MediaItemShareExtraData {
  [key: string]: unknown
}
