import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, Sequelize } from 'sequelize'
import type { DeviceExtraData } from './types'

const oldDevice = require('../objects/DeviceInfo')

class Device extends Model<InferAttributes<Device>, InferCreationAttributes<Device>> {
  declare id: CreationOptional<string>
  declare deviceId: string
  declare clientName: CreationOptional<string | null>
  declare clientVersion: CreationOptional<string | null>
  declare ipAddress: CreationOptional<string | null>
  declare deviceName: CreationOptional<string | null>
  declare deviceVersion: CreationOptional<string | null>
  declare extraData: CreationOptional<DeviceExtraData>
  declare userId: ForeignKey<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static async getOldDeviceByDeviceId(deviceId: string) {
    const device = await this.findOne({
      where: {
        deviceId
      }
    })
    if (!device) return null
    return device.getOldDevice()
  }

  static createFromOld(oldDeviceInfo: Record<string, unknown>) {
    const device = this.getFromOld(oldDeviceInfo)
    return this.create(device)
  }

  static updateFromOld(oldDeviceInfo: Record<string, unknown>) {
    const device = this.getFromOld(oldDeviceInfo)
    return this.update(device, {
      where: {
        id: device.id
      }
    })
  }

  static getFromOld(oldDeviceInfo: Record<string, any>) {
    const extraData: DeviceExtraData = {}

    if (oldDeviceInfo.manufacturer) {
      extraData.manufacturer = oldDeviceInfo.manufacturer
    }
    if (oldDeviceInfo.model) {
      extraData.model = oldDeviceInfo.model
    }
    if (oldDeviceInfo.osName) {
      extraData.osName = oldDeviceInfo.osName
    }
    if (oldDeviceInfo.osVersion) {
      extraData.osVersion = oldDeviceInfo.osVersion
    }
    if (oldDeviceInfo.browserName) {
      extraData.browserName = oldDeviceInfo.browserName
    }

    return {
      id: oldDeviceInfo.id,
      deviceId: oldDeviceInfo.deviceId,
      clientName: oldDeviceInfo.clientName || null,
      clientVersion: oldDeviceInfo.clientVersion || null,
      ipAddress: oldDeviceInfo.ipAddress,
      deviceName: oldDeviceInfo.deviceName || null,
      deviceVersion: oldDeviceInfo.sdkVersion || oldDeviceInfo.browserVersion || null,
      userId: oldDeviceInfo.userId,
      extraData
    }
  }

  static init(...args: any[]): any {
    const sequelize = args[0] as Sequelize
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        deviceId: DataTypes.STRING,
        clientName: DataTypes.STRING,
        clientVersion: DataTypes.STRING,
        ipAddress: DataTypes.STRING,
        deviceName: DataTypes.STRING,
        deviceVersion: DataTypes.STRING,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'device'
      }
    )

    const { user } = sequelize.models

    user.hasMany(Device, {
      onDelete: 'CASCADE'
    })
    Device.belongsTo(user)
  }

  toOldJSON() {
    let browserVersion = null
    let sdkVersion = null
    if (this.clientName === 'Abs Android') {
      sdkVersion = this.deviceVersion || null
    } else {
      browserVersion = this.deviceVersion || null
    }

    return {
      id: this.id,
      deviceId: this.deviceId,
      userId: this.userId,
      ipAddress: this.ipAddress,
      browserName: this.extraData.browserName || null,
      browserVersion,
      osName: this.extraData.osName || null,
      osVersion: this.extraData.osVersion || null,
      clientVersion: this.clientVersion || null,
      manufacturer: this.extraData.manufacturer || null,
      model: this.extraData.model || null,
      sdkVersion,
      deviceName: this.deviceName,
      clientName: this.clientName
    }
  }

  getOldDevice() {
    let browserVersion = null
    let sdkVersion = null
    if (this.clientName === 'Abs Android') {
      sdkVersion = this.deviceVersion || null
    } else {
      browserVersion = this.deviceVersion || null
    }

    return new oldDevice({
      id: this.id,
      deviceId: this.deviceId,
      userId: this.userId,
      ipAddress: this.ipAddress,
      browserName: this.extraData.browserName || null,
      browserVersion,
      osName: this.extraData.osName || null,
      osVersion: this.extraData.osVersion || null,
      clientVersion: this.clientVersion || null,
      manufacturer: this.extraData.manufacturer || null,
      model: this.extraData.model || null,
      sdkVersion,
      deviceName: this.deviceName,
      clientName: this.clientName
    })
  }
}

export = Device
