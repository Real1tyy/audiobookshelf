import { z } from 'zod'
import { createZodClass } from '../zodHelpers'
import FileMetadata = require('../metadata/FileMetadata')

const EBookFileSchema = z.object({
  ino: z.string().nullable().default(null),
  metadata: z.any().nullable().default(null),
  ebookFormat: z.string().nullable().default(null),
  addedAt: z.number().nullable().default(null),
  updatedAt: z.number().nullable().default(null)
})

class EBookFile extends createZodClass(EBookFileSchema) {
  declare metadata: InstanceType<typeof FileMetadata>

  constructor(data?: any) {
    super(data)
    if (data) {
      this.metadata = new FileMetadata(data.metadata)
      if (!this.ebookFormat) this.ebookFormat = this.metadata.format
    }
  }

  get isEpub(): boolean {
    return this.ebookFormat === 'epub'
  }

  setData(libraryFile: any) {
    this.ino = libraryFile.ino
    this.metadata = libraryFile.metadata.clone()
    this.ebookFormat = libraryFile.metadata.format
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  updateFromLibraryFile(libraryFile: any): boolean {
    let hasUpdated = false
    if (this.metadata.update(libraryFile.metadata)) hasUpdated = true
    if (this.ebookFormat !== libraryFile.metadata.format) {
      this.ebookFormat = libraryFile.metadata.format
      hasUpdated = true
    }
    return hasUpdated
  }
}

export = EBookFile
