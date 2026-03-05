import Path from 'path'
import date from 'date-and-time'
import { z } from 'zod'
import { createZodClass } from './zodHelpers'
const version = require('../../package.json').version

const BackupSchema = z.object({
  id: z.string().nullable().default(null),
  key: z.string().nullable().default(null),
  datePretty: z.string().nullable().default(null),
  backupDirPath: z.string().nullable().default(null),
  filename: z.string().nullable().default(null),
  path: z.string().nullable().default(null),
  fullPath: z.string().nullable().default(null),
  serverVersion: z.string().nullable().default(null),
  fileSize: z.number().nullable().default(null),
  createdAt: z.number().nullable().default(null)
})

class Backup extends createZodClass(BackupSchema) {
  constructor(data?: any) {
    if (data?.details) {
      const id = data.details[0]
      let key = data.details[1]
      if (key == 1) key = null
      const createdAt = Number(data.details[2])
      const serverVersion = data.details[3] || null

      super({
        id, key, createdAt, serverVersion,
        datePretty: date.format(new Date(createdAt), 'ddd, MMM D YYYY HH:mm'),
        backupDirPath: Path.dirname(data.fullPath),
        filename: Path.basename(data.fullPath),
        path: Path.join('backups', Path.basename(data.fullPath)),
        fullPath: data.fullPath
      })
    } else {
      super(data)
    }
  }

  get detailsString(): string {
    return [this.id, this.key, this.createdAt, this.serverVersion].join('\n')
  }

  setData(backupDirPath: string) {
    this.id = date.format(new Date(), 'YYYY-MM-DD[T]HHmm')
    this.key = 'sqlite'
    this.datePretty = date.format(new Date(), 'ddd, MMM D YYYY HH:mm')
    this.backupDirPath = backupDirPath
    this.filename = this.id + '.audiobookshelf'
    this.path = Path.join('backups', this.filename)
    this.fullPath = Path.join(this.backupDirPath, this.filename)
    this.serverVersion = version
    this.createdAt = Date.now()
  }
}

export = Backup
