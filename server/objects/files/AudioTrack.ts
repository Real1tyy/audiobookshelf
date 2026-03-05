import { z } from 'zod'
import { createZodClass } from '../zodHelpers'
import FileMetadata = require('../metadata/FileMetadata')

const AudioTrackSchema = z.object({
  index: z.number().nullable().default(null),
  startOffset: z.number().nullable().default(null),
  duration: z.number().nullable().default(null),
  title: z.string().nullable().default(null),
  contentUrl: z.string().nullable().default(null),
  mimeType: z.string().nullable().default(null),
  codec: z.string().nullable().default(null),
  metadata: z.any().nullable().default(null)
})

class AudioTrack extends createZodClass(AudioTrackSchema) {
  setData(itemId: string, audioFile: any, startOffset: number) {
    this.index = audioFile.index
    this.startOffset = startOffset
    this.duration = audioFile.duration
    this.title = audioFile.metadata?.filename || ''
    this.contentUrl = `/api/items/${itemId}/file/${audioFile.ino}`
    this.mimeType = audioFile.mimeType
    this.codec = audioFile.codec || null
    this.metadata = audioFile.metadata instanceof FileMetadata
      ? audioFile.metadata.clone()
      : new FileMetadata(audioFile.metadata)
  }

  setFromStream(title: string, duration: number, contentUrl: string) {
    this.index = 1
    this.startOffset = 0
    this.duration = duration
    this.title = title
    this.contentUrl = contentUrl
    this.mimeType = 'application/vnd.apple.mpegurl'
  }
}

export = AudioTrack
