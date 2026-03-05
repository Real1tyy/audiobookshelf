import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { createZodClass } from './zodHelpers'

const DeviceInfoSchema = z.object({
  id: z.string().nullable().default(null),
  userId: z.string().nullable().default(null),
  deviceId: z.string().nullable().default(null),
  ipAddress: z.string().nullable().default(null),
  browserName: z.string().nullable().default(null),
  browserVersion: z.string().nullable().default(null),
  osName: z.string().nullable().default(null),
  osVersion: z.string().nullable().default(null),
  deviceType: z.string().nullable().default(null),
  clientVersion: z.string().nullable().default(null),
  manufacturer: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  sdkVersion: z.string().nullable().default(null),
  clientName: z.string().nullable().default(null),
  deviceName: z.string().nullable().default(null)
})

class DeviceInfo extends createZodClass(DeviceInfoSchema) {
  // Override: strip null/undefined values from output (matches original behavior)
  toJSON() {
    const obj: Record<string, any> = {}
    for (const key of Object.keys(DeviceInfoSchema.shape)) {
      const val = (this as any)[key]
      if (val != null) obj[key] = val
    }
    return obj
  }

  get deviceDescription(): string {
    if (this.model) {
      if (this.sdkVersion) return `${this.model} SDK ${this.sdkVersion} / v${this.clientVersion}`
      return `${this.model} / v${this.clientVersion}`
    }
    return `${this.osName} ${this.osVersion} / ${this.browserName}`
  }

  getTempDeviceId(): string {
    const keys = [
      this.userId, this.browserName, this.browserVersion,
      this.osName, this.osVersion, this.clientVersion,
      this.manufacturer, this.model, this.sdkVersion, this.ipAddress
    ].map((k) => k || '')
    return 'temp-' + Buffer.from(keys.join('-'), 'utf-8').toString('base64')
  }

  setData(ip: string | null, ua: any, clientDeviceInfo: any, serverVersion: string, userId: string) {
    this.id = uuidv4()
    this.userId = userId
    this.deviceId = clientDeviceInfo?.deviceId || this.id
    this.ipAddress = ip || null

    this.browserName = ua?.browser.name || null
    this.browserVersion = ua?.browser.version || null
    this.osName = ua?.os.name || null
    this.osVersion = ua?.os.version || null
    this.deviceType = ua?.device.type || null

    this.clientVersion = clientDeviceInfo?.clientVersion || serverVersion
    this.manufacturer = clientDeviceInfo?.manufacturer || null
    this.model = clientDeviceInfo?.model || null
    this.sdkVersion = clientDeviceInfo?.sdkVersion || null

    this.clientName = clientDeviceInfo?.clientName || null
    if (this.sdkVersion) {
      if (!this.clientName) this.clientName = 'Abs Android'
      this.deviceName = `${this.manufacturer || 'Unknown'} ${this.model || ''}`
    } else if (this.model) {
      if (!this.clientName) this.clientName = 'Abs iOS'
      this.deviceName = `${this.manufacturer || 'Unknown'} ${this.model || ''}`
    } else if (this.osName && this.browserName) {
      if (!this.clientName) this.clientName = 'Abs Web'
      this.deviceName = `${this.osName} ${this.osVersion || 'N/A'} ${this.browserName}`
    } else if (!this.clientName) {
      this.clientName = 'Unknown'
    }

    if (!this.deviceId) {
      this.deviceId = this.getTempDeviceId()
    }
  }

  update(deviceInfo: any): boolean {
    const deviceInfoJson = deviceInfo.toJSON ? deviceInfo.toJSON() : deviceInfo
    const existingJson = this.toJSON()
    let hasUpdates = false

    for (const key in deviceInfoJson) {
      if (['id', 'deviceId'].includes(key)) continue
      if (deviceInfoJson[key] !== existingJson[key]) {
        ;(this as any)[key] = deviceInfoJson[key]
        hasUpdates = true
      }
    }
    for (const key in existingJson) {
      if (['id', 'deviceId'].includes(key)) continue
      if (existingJson[key] && !deviceInfoJson[key]) {
        ;(this as any)[key] = null
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}

export = DeviceInfo
