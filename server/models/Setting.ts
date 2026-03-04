import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from 'sequelize'

const oldEmailSettings = require('../objects/settings/EmailSettings')
const oldServerSettings = require('../objects/settings/ServerSettings')

class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare key: string
  declare value: Record<string, unknown>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static async getOldSettings() {
    const settings = (await this.findAll()).map((se) => se.value)

    const emailSettingsJson = settings.find((se) => (se as any).id === 'email-settings')
    const serverSettingsJson = settings.find((se) => (se as any).id === 'server-settings')

    return {
      settings,
      emailSettings: new oldEmailSettings(emailSettingsJson),
      serverSettings: new oldServerSettings(serverSettingsJson)
    }
  }

  static updateSettingObj(setting: { id: string; [key: string]: unknown }) {
    return this.upsert({
      key: setting.id,
      value: setting as Record<string, unknown>
    })
  }

  static init(...args: any[]): any {
    const sequelize = args[0] as Sequelize
    super.init(
      {
        key: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        value: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'setting'
      }
    )
  }
}

export = Setting
