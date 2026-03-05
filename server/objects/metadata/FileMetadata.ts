import { z } from 'zod'
import { createZodClass } from '../zodHelpers'

const FileMetadataSchema = z.object({
  filename: z.string().nullable().default(null),
  ext: z.string().nullable().default(null),
  path: z.string().nullable().default(null),
  relPath: z.string().nullable().default(null),
  size: z.number().nullable().default(null),
  mtimeMs: z.number().nullable().default(null),
  ctimeMs: z.number().nullable().default(null),
  birthtimeMs: z.number().nullable().default(null)
})

class FileMetadata extends createZodClass(FileMetadataSchema) {
  wasModified = false

  get format(): string {
    if (!this.ext) return ''
    return this.ext.slice(1).toLowerCase()
  }

  get filenameNoExt(): string {
    return (this.filename ?? '').replace(this.ext ?? '', '')
  }

  setData(payload: Record<string, any>) {
    for (const key of Object.keys(FileMetadataSchema.shape)) {
      if (payload[key] !== undefined) {
        ;(this as any)[key] = payload[key]
      }
    }
  }
}

export = FileMetadata
