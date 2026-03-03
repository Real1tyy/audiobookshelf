import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, Sequelize } from 'sequelize'

class SeriesProgress extends Model<InferAttributes<SeriesProgress>, InferCreationAttributes<SeriesProgress>> {
  declare id: CreationOptional<string>
  declare userId: ForeignKey<string>
  declare seriesId: ForeignKey<string>
  declare currentBookId: CreationOptional<string | null>
  declare currentTime: CreationOptional<number>
  declare currentBookIndex: CreationOptional<number>
  declare isFinished: CreationOptional<boolean>
  declare lastPlayedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static init(...args: any[]): any {
    const sequelize = args[0] as Sequelize
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        currentBookId: DataTypes.UUID,
        currentTime: {
          type: DataTypes.FLOAT,
          defaultValue: 0
        },
        currentBookIndex: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        isFinished: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        lastPlayedAt: DataTypes.DATE
      },
      {
        sequelize,
        modelName: 'seriesProgress',
        indexes: [
          {
            unique: true,
            fields: ['userId', 'seriesId']
          },
          {
            fields: ['lastPlayedAt']
          }
        ]
      }
    )

    const { user, series } = sequelize.models

    user.hasMany(SeriesProgress, {
      onDelete: 'CASCADE'
    })
    SeriesProgress.belongsTo(user)

    series.hasMany(SeriesProgress, {
      onDelete: 'CASCADE'
    })
    SeriesProgress.belongsTo(series)
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      seriesId: this.seriesId,
      currentBookId: this.currentBookId,
      currentTime: this.currentTime,
      currentBookIndex: this.currentBookIndex,
      isFinished: !!this.isFinished,
      lastPlayedAt: this.lastPlayedAt?.valueOf() || null,
      createdAt: this.createdAt?.valueOf() || null,
      updatedAt: this.updatedAt?.valueOf() || null
    }
  }
}

export = SeriesProgress
