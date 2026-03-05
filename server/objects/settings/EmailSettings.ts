import { z } from 'zod'
import { createZodClass, deepEqual } from '../zodHelpers'
const Logger = require('../../Logger')

interface EreaderDeviceObject {
  name: string
  email: string
  availabilityOption: string
  users: string[]
}

const EmailSettingsSchema = z.object({
  id: z.string().default('email-settings'),
  host: z.string().nullable().default(null),
  port: z.number().default(465),
  secure: z.boolean().default(true),
  rejectUnauthorized: z.boolean().default(true),
  user: z.string().nullable().default(null),
  pass: z.string().nullable().default(null),
  testAddress: z.string().nullable().default(null),
  fromAddress: z.string().nullable().default(null),
  ereaderDevices: z.array(z.any()).default([])
})

class EmailSettings extends createZodClass(EmailSettingsSchema) {
  declare ereaderDevices: EreaderDeviceObject[]

  constructor(settings?: any) {
    super(settings)
    if (settings) {
      this.secure = !!settings.secure
      this.rejectUnauthorized = settings.rejectUnauthorized === undefined ? true : !!settings.rejectUnauthorized
      this.ereaderDevices = settings.ereaderDevices?.map((d: any) => ({ ...d })) || []
    }
  }

  update(payload: any): boolean {
    if (!payload) return false

    if (payload.port !== undefined) {
      payload.port = (payload.port == null || isNaN(payload.port)) ? 465 : Number(payload.port)
    }
    if (payload.secure !== undefined) payload.secure = !!payload.secure
    if (payload.rejectUnauthorized !== undefined) payload.rejectUnauthorized = !!payload.rejectUnauthorized
    if (payload.ereaderDevices !== undefined && !Array.isArray(payload.ereaderDevices)) payload.ereaderDevices = undefined

    if (payload.ereaderDevices?.length) {
      payload.ereaderDevices = payload.ereaderDevices
        .map((device: any) => {
          if (!device.name || !device.email) {
            Logger.error(`[EmailSettings] Update ereader device is invalid`, device)
            return null
          }
          if (!device.availabilityOption || !['adminOrUp', 'userOrUp', 'guestOrUp', 'specificUsers'].includes(device.availabilityOption)) {
            device.availabilityOption = 'adminOrUp'
          }
          if (device.availabilityOption === 'specificUsers' && !device.users?.length) {
            device.availabilityOption = 'adminOrUp'
          }
          if (device.availabilityOption !== 'specificUsers' && device.users?.length) {
            device.users = []
          }
          return device
        })
        .filter((d: any) => d)
    }

    let hasUpdates = false
    const json = this.toJSON()
    for (const key in json) {
      if (key === 'id') continue
      if (payload[key] !== undefined && !deepEqual(payload[key], (json as any)[key])) {
        ;(this as any)[key] = structuredClone(payload[key])
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  getTransportObject() {
    const payload: Record<string, any> = { host: this.host, secure: this.secure }
    if (this.port !== 465) payload.secure = false
    if (this.port) payload.port = this.port
    if (this.user && this.pass !== undefined) {
      payload.auth = { user: this.user, pass: this.pass }
    }
    if (!this.rejectUnauthorized) {
      payload.tls = { rejectUnauthorized: false }
    }
    return payload
  }

  checkUserCanAccessDevice(device: EreaderDeviceObject, user: any): boolean {
    const availability = device.availabilityOption || 'adminOrUp'
    if (availability === 'adminOrUp' && user.isAdminOrUp) return true
    if (availability === 'userOrUp' && (user.isAdminOrUp || user.isUser)) return true
    if (availability === 'guestOrUp') return true
    if (availability === 'specificUsers') return (device.users || []).includes(user.id)
    return false
  }

  getEReaderDevices(user: any): EreaderDeviceObject[] {
    return this.ereaderDevices.filter((device) => this.checkUserCanAccessDevice(device, user))
  }

  getEReaderDevice(deviceName: string): EreaderDeviceObject | undefined {
    return this.ereaderDevices.find((d) => d.name === deviceName)
  }
}

export = EmailSettings
