import Path from 'path'
import { z } from 'zod'
import { createZodClass } from '../zodHelpers'
import FileMetadata = require('../metadata/FileMetadata')
const { getFileTimestampsWithIno, filePathToPOSIX } = require('../../utils/fileUtils')
const globals = require('../../utils/globals')

const LibraryFileSchema = z.object({
  ino: z.string().nullable().default(null),
  metadata: z.any().nullable().default(null),
  isSupplementary: z.boolean().nullable().default(null),
  addedAt: z.number().nullable().default(null),
  updatedAt: z.number().nullable().default(null)
})

class LibraryFile extends createZodClass(LibraryFileSchema) {
  declare metadata: InstanceType<typeof FileMetadata>

  constructor(data?: any) {
    super(data)
    if (data) {
      this.metadata = new FileMetadata(data.metadata)
      if (data.isSupplementary === undefined) this.isSupplementary = null
    }
  }

  // Override to include computed fileType
  toJSON() {
    const base = Object.getPrototypeOf(Object.getPrototypeOf(this)).toJSON.call(this)
    base.fileType = this.fileType
    return base
  }

  get fileType(): string {
    if (!this.metadata) return 'unknown'
    if (globals.SupportedImageTypes.includes(this.metadata.format)) return 'image'
    if (globals.SupportedAudioTypes.includes(this.metadata.format)) return 'audio'
    if (globals.SupportedEbookTypes.includes(this.metadata.format)) return 'ebook'
    if (globals.TextFileTypes.includes(this.metadata.format)) return 'text'
    if (globals.MetadataFileTypes.includes(this.metadata.format)) return 'metadata'
    return 'unknown'
  }

  get isMediaFile(): boolean {
    return this.fileType === 'audio' || this.fileType === 'ebook'
  }

  get isEBookFile(): boolean {
    return this.fileType === 'ebook'
  }

  get isOPFFile(): boolean {
    return this.metadata?.ext === '.opf'
  }

  async setDataFromPath(path: string, relPath: string) {
    const fileTsData = await getFileTimestampsWithIno(path)
    const fileMetadata = new FileMetadata()
    fileMetadata.setData(fileTsData)
    fileMetadata.filename = Path.basename(relPath)
    fileMetadata.path = filePathToPOSIX(path)
    fileMetadata.relPath = filePathToPOSIX(relPath)
    fileMetadata.ext = Path.extname(relPath)
    this.ino = fileTsData.ino
    this.metadata = fileMetadata
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }
}

export = LibraryFile
