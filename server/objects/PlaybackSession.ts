import date from 'date-and-time'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { createZodClass } from './zodHelpers'
import DeviceInfo = require('./DeviceInfo')
const serverVersion = require('../../package.json').version

const PlaybackSessionSchema = z.object({
  id: z.string().nullable().default(null),
  userId: z.string().nullable().default(null),
  libraryId: z.string().nullable().default(null),
  libraryItemId: z.string().nullable().default(null),
  bookId: z.string().nullable().default(null),
  mediaType: z.string().nullable().default(null),
  mediaMetadata: z.any().nullable().default(null),
  chapters: z.array(z.any()).nullable().default(null),
  displayTitle: z.string().nullable().default(null),
  displayAuthor: z.string().nullable().default(null),
  coverPath: z.string().nullable().default(null),
  duration: z.number().nullable().default(null),
  playMethod: z.number().nullable().default(null),
  mediaPlayer: z.string().nullable().default(null),
  deviceInfo: z.any().nullable().default(null),
  serverVersion: z.string().nullable().default(null),
  date: z.string().nullable().default(null),
  dayOfWeek: z.string().nullable().default(null),
  timeListening: z.number().nullable().default(null),
  startTime: z.number().default(0),
  currentTime: z.number().default(0),
  startedAt: z.number().nullable().default(null),
  updatedAt: z.number().nullable().default(null)
})

class PlaybackSession extends createZodClass(PlaybackSessionSchema) {
  declare deviceInfo: InstanceType<typeof DeviceInfo> | null

  // Not saved in DB
  lastSave = 0
  audioTracks: any[] = []
  stream: any = null
  shareSessionId: string | null = null
  mediaItemShareId: string | null = null
  coverAspectRatio: number | null = null

  constructor(session?: any) {
    super(session)
    if (session) {
      if (this.libraryId?.startsWith('lib_')) this.libraryId = null
      if (this.libraryItemId?.startsWith('li_') || this.libraryItemId?.startsWith('local_')) this.libraryItemId = null

      if (session.deviceInfo instanceof DeviceInfo) {
        this.deviceInfo = new DeviceInfo(session.deviceInfo.toJSON())
      } else {
        this.deviceInfo = new DeviceInfo(session.deviceInfo)
      }

      this.mediaPlayer = session.mediaPlayer || null
      this.displayTitle = session.displayTitle || ''
      this.displayAuthor = session.displayAuthor || ''
      this.timeListening = session.timeListening || null
      this.startTime = session.startTime || 0
      this.currentTime = session.currentTime || 0
      this.updatedAt = session.updatedAt || session.startedAt

      if (!this.date && session.updatedAt) {
        this.date = date.format(new Date(session.updatedAt), 'YYYY-MM-DD')
        this.dayOfWeek = date.format(new Date(session.updatedAt), 'dddd')
      }
    }
  }

  // Override to deep-clone mediaMetadata and chapters
  toJSON() {
    const base = Object.getPrototypeOf(Object.getPrototypeOf(this)).toJSON.call(this)
    base.mediaMetadata = structuredClone(this.mediaMetadata)
    base.chapters = (this.chapters || []).map((c: any) => ({ ...c }))
    return base
  }

  toJSONForClient(libraryItem?: any) {
    return {
      ...this.toJSON(),
      audioTracks: this.audioTracks.map((at: any) => at.toJSON?.() || { ...at }),
      libraryItem: libraryItem?.toOldJSONExpanded() || null
    }
  }

  get mediaItemId() { return this.libraryItemId }

  get progress(): number {
    if (!this.duration) return 0
    return Math.max(0, Math.min(this.currentTime / this.duration, 1))
  }

  get deviceId(): string | undefined {
    return this.deviceInfo?.id ?? undefined
  }

  get deviceDescription(): string {
    if (!this.deviceInfo) return 'No Device Info'
    return this.deviceInfo.deviceDescription
  }

  get mediaProgressObject() {
    return {
      duration: this.duration,
      currentTime: this.currentTime,
      progress: this.progress,
      lastUpdate: this.updatedAt
    }
  }

  setData(libraryItem: any, userId: string, mediaPlayer: string, deviceInfo: any, startTime: number) {
    this.id = uuidv4()
    this.userId = userId
    this.libraryId = libraryItem.libraryId
    this.libraryItemId = libraryItem.id
    this.bookId = libraryItem.media.id
    this.mediaType = libraryItem.mediaType
    this.mediaMetadata = libraryItem.media.oldMetadataToJSON()
    this.chapters = libraryItem.media.getChapters()
    this.displayTitle = libraryItem.media.getPlaybackTitle()
    this.displayAuthor = libraryItem.media.getPlaybackAuthor()
    this.coverPath = libraryItem.media.coverPath
    this.duration = libraryItem.media.getPlaybackDuration()

    this.mediaPlayer = mediaPlayer
    this.deviceInfo = deviceInfo || new DeviceInfo()
    this.serverVersion = serverVersion

    this.timeListening = 0
    this.startTime = startTime
    this.currentTime = startTime

    this.date = date.format(new Date(), 'YYYY-MM-DD')
    this.dayOfWeek = date.format(new Date(), 'dddd')
    this.startedAt = Date.now()
    this.updatedAt = Date.now()
  }

  addListeningTime(timeListened: number) {
    if (!timeListened || isNaN(timeListened)) return

    if (!this.date) {
      this.date = date.format(new Date(), 'YYYY-MM-DD')
      this.dayOfWeek = date.format(new Date(), 'dddd')
    }

    this.timeListening = (this.timeListening || 0) + Number.parseFloat(String(timeListened))
    this.updatedAt = Date.now()
  }
}

export = PlaybackSession
