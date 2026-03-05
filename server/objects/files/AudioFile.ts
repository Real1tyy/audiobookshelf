import { z } from 'zod'
import { createZodClass } from '../zodHelpers'
import FileMetadata = require('../metadata/FileMetadata')
import AudioMetaTags = require('../metadata/AudioMetaTags')
const { AudioMimeType } = require('../../utils/constants')

const AudioFileSchema = z.object({
  index: z.number().nullable().default(null),
  ino: z.string().nullable().default(null),
  metadata: z.any().nullable().default(null),
  addedAt: z.number().nullable().default(null),
  updatedAt: z.number().nullable().default(null),
  trackNumFromMeta: z.number().nullable().default(null),
  discNumFromMeta: z.number().nullable().default(null),
  trackNumFromFilename: z.number().nullable().default(null),
  discNumFromFilename: z.number().nullable().default(null),
  format: z.string().nullable().default(null),
  duration: z.number().nullable().default(null),
  bitRate: z.number().nullable().default(null),
  language: z.string().nullable().default(null),
  codec: z.string().nullable().default(null),
  timeBase: z.string().nullable().default(null),
  channels: z.number().nullable().default(null),
  channelLayout: z.string().nullable().default(null),
  chapters: z.array(z.any()).default([]),
  embeddedCoverArt: z.string().nullable().default(null),
  metaTags: z.any().nullable().default(null),
  manuallyVerified: z.boolean().default(false),
  exclude: z.boolean().default(false),
  error: z.string().nullable().default(null)
})

class AudioFile extends createZodClass(AudioFileSchema) {
  declare metadata: InstanceType<typeof FileMetadata>
  declare metaTags: InstanceType<typeof AudioMetaTags>

  constructor(data?: any) {
    super(data)
    if (data) {
      this.metadata = new FileMetadata(data.metadata || {})
      this.metaTags = new AudioMetaTags(data.metaTags || {})
      this.manuallyVerified = !!data.manuallyVerified
      this.exclude = !!data.exclude
      if (data.cdNumFromFilename !== undefined) {
        this.discNumFromFilename = data.cdNumFromFilename
      }
    } else {
      this.metadata = new FileMetadata()
      this.metaTags = new AudioMetaTags()
    }
  }

  // Override to add computed mimeType
  toJSON() {
    const base = Object.getPrototypeOf(Object.getPrototypeOf(this)).toJSON.call(this)
    base.manuallyVerified = !!this.manuallyVerified
    base.exclude = !!this.exclude
    base.error = this.error || null
    base.mimeType = this.mimeType
    return base
  }

  get mimeType(): string {
    const format = this.metadata?.format?.toUpperCase() ?? ''
    return AudioMimeType[format] || AudioMimeType.MP3
  }

  setDataFromProbe(libraryFile: any, probeData: any) {
    this.ino = libraryFile.ino || null
    this.metadata = libraryFile.metadata instanceof FileMetadata
      ? libraryFile.metadata.clone()
      : new FileMetadata(libraryFile.metadata)
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
    this.format = probeData.format
    this.duration = probeData.duration
    this.bitRate = probeData.bitRate || null
    this.language = probeData.language
    this.codec = probeData.codec || null
    this.timeBase = probeData.timeBase
    this.channels = probeData.channels
    this.channelLayout = probeData.channelLayout
    this.chapters = probeData.chapters || []
    this.metaTags = probeData.audioMetaTags
    this.embeddedCoverArt = probeData.embeddedCoverArt
  }

  syncChapters(updatedChapters: any[]): boolean {
    if (this.chapters.length !== updatedChapters.length) {
      this.chapters = updatedChapters.map((ch) => ({ ...ch }))
      return true
    }
    if (updatedChapters.length === 0) {
      if (this.chapters.length > 0) {
        this.chapters = []
        return true
      }
      return false
    }
    let hasUpdates = false
    for (let i = 0; i < updatedChapters.length; i++) {
      if (JSON.stringify(updatedChapters[i]) !== JSON.stringify(this.chapters[i])) {
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.chapters = updatedChapters.map((ch) => ({ ...ch }))
    }
    return hasUpdates
  }

  updateFromScan(scannedAudioFile: any): boolean {
    let hasUpdated = false
    const newjson = scannedAudioFile.toJSON()
    const ignoreKeys = ['manuallyVerified', 'ctimeMs', 'addedAt', 'updatedAt']

    for (const key in newjson) {
      if (key === 'metadata') {
        if (this.metadata.update(newjson[key])) hasUpdated = true
      } else if (key === 'metaTags') {
        if (!this.metaTags || !this.metaTags.isEqual(scannedAudioFile.metaTags)) {
          this.metaTags = scannedAudioFile.metaTags.clone()
          hasUpdated = true
        }
      } else if (key === 'chapters') {
        if (this.syncChapters(newjson.chapters || [])) hasUpdated = true
      } else if (!ignoreKeys.includes(key) && (this as any)[key] !== newjson[key]) {
        ;(this as any)[key] = newjson[key]
        hasUpdated = true
      }
    }
    return hasUpdated
  }
}

export = AudioFile
