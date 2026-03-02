const { DataTypes, Model } = require('sequelize')

class SeriesProgress extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.userId
    /** @type {UUIDV4} */
    this.seriesId
    /** @type {UUIDV4} */
    this.currentBookId
    /** @type {number} */
    this.currentTime
    /** @type {number} */
    this.currentBookIndex
    /** @type {boolean} */
    this.isFinished
    /** @type {Date} */
    this.lastPlayedAt
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
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

module.exports = SeriesProgress
