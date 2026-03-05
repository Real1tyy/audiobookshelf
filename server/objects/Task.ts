import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { createZodClass } from './zodHelpers'

interface TaskString {
  text: string
  key?: string
  subs?: string[]
}

const TaskSchema = z.object({
  id: z.string().nullable().default(null),
  action: z.string().nullable().default(null),
  data: z.any().nullable().default(null),
  title: z.string().nullable().default(null),
  titleKey: z.string().nullable().default(null),
  titleSubs: z.array(z.string()).nullable().default(null),
  description: z.string().nullable().default(null),
  descriptionKey: z.string().nullable().default(null),
  descriptionSubs: z.array(z.string()).nullable().default(null),
  error: z.string().nullable().default(null),
  errorKey: z.string().nullable().default(null),
  errorSubs: z.array(z.string()).nullable().default(null),
  showSuccess: z.boolean().default(false),
  isFailed: z.boolean().default(false),
  isFinished: z.boolean().default(false),
  startedAt: z.number().nullable().default(null),
  finishedAt: z.number().nullable().default(null)
})

class Task extends createZodClass(TaskSchema) {
  failedAt?: number

  setData(action: string, titleString: TaskString, descriptionString: TaskString | null, showSuccess: boolean, data: Record<string, any> = {}) {
    this.id = uuidv4()
    this.action = action
    this.data = { ...data }
    this.title = titleString.text
    this.titleKey = titleString.key || null
    this.titleSubs = titleString.subs || null
    this.description = descriptionString?.text || null
    this.descriptionKey = descriptionString?.key || null
    this.descriptionSubs = descriptionString?.subs || null
    this.showSuccess = showSuccess
    this.startedAt = Date.now()
  }

  setFailed(messageString: TaskString) {
    this.error = messageString.text
    this.errorKey = messageString.key || null
    this.errorSubs = messageString.subs || null
    this.isFailed = true
    this.failedAt = Date.now()
    this.setFinished()
  }

  setFinished(newDescriptionString: TaskString | null = null, clearDescription = false) {
    if (newDescriptionString) {
      this.description = newDescriptionString.text
      this.descriptionKey = newDescriptionString.key || null
      this.descriptionSubs = newDescriptionString.subs || null
    } else if (clearDescription) {
      this.description = null
      this.descriptionKey = null
      this.descriptionSubs = null
    }
    this.isFinished = true
    this.finishedAt = Date.now()
  }
}

export = Task
