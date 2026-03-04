import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, NonAttribute, Sequelize } from 'sequelize'

const oldPlaybackSession = require('../objects/PlaybackSession')

class PlaybackSession extends Model<InferAttributes<PlaybackSession>, InferCreationAttributes<PlaybackSession>> {
  declare id: CreationOptional<string>
  declare mediaItemId: string
  declare mediaItemType: string
  declare displayTitle: string | null
  declare displayAuthor: string | null
  declare duration: number | null
  declare playMethod: number | null
  declare mediaPlayer: string | null
  declare startTime: number | null
  declare currentTime: number | null
  declare serverVersion: string | null
  declare coverPath: string | null
  declare timeListening: number | null
  declare mediaMetadata: any | null
  declare date: string | null
  declare dayOfWeek: string | null
  declare extraData: any | null
  declare userId: ForeignKey<string>
  declare deviceId: ForeignKey<string | null>
  declare libraryId: ForeignKey<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties
  declare mediaItem?: NonAttribute<any>
  declare device?: NonAttribute<any>

  static async getOldPlaybackSessions(where: any = null) {
    const playbackSessions = await this.findAll({
      where,
      include: [
        {
          model: this.sequelize!.models.device
        }
      ]
    })
    return playbackSessions.map((session) => this.getOldPlaybackSession(session))
  }

  static async getById(sessionId: string) {
    const playbackSession = await this.findByPk(sessionId, {
      include: [
        {
          model: this.sequelize!.models.device
        }
      ]
    })
    if (!playbackSession) return null
    return this.getOldPlaybackSession(playbackSession)
  }

  static getOldPlaybackSession(playbackSessionExpanded: PlaybackSession) {
    return new oldPlaybackSession({
      id: playbackSessionExpanded.id,
      userId: playbackSessionExpanded.userId,
      libraryId: playbackSessionExpanded.libraryId,
      libraryItemId: playbackSessionExpanded.extraData?.libraryItemId || null,
      bookId: playbackSessionExpanded.mediaItemId,
      mediaType: 'book',
      mediaMetadata: playbackSessionExpanded.mediaMetadata,
      chapters: null,
      displayTitle: playbackSessionExpanded.displayTitle,
      displayAuthor: playbackSessionExpanded.displayAuthor,
      coverPath: playbackSessionExpanded.coverPath,
      duration: playbackSessionExpanded.duration,
      playMethod: playbackSessionExpanded.playMethod,
      mediaPlayer: playbackSessionExpanded.mediaPlayer,
      deviceInfo: (playbackSessionExpanded as any).device?.getOldDevice() || null,
      serverVersion: playbackSessionExpanded.serverVersion,
      date: playbackSessionExpanded.date,
      dayOfWeek: playbackSessionExpanded.dayOfWeek,
      timeListening: playbackSessionExpanded.timeListening,
      startTime: playbackSessionExpanded.startTime,
      currentTime: playbackSessionExpanded.currentTime,
      startedAt: playbackSessionExpanded.createdAt.valueOf(),
      updatedAt: playbackSessionExpanded.updatedAt.valueOf()
    })
  }

  static removeById(sessionId: string) {
    return this.destroy({
      where: {
        id: sessionId
      }
    })
  }

  static createFromOld(oldPlaybackSessionObj: any) {
    const playbackSession = this.getFromOld(oldPlaybackSessionObj)
    return this.upsert(playbackSession, {
      silent: true
    } as any)
  }

  static updateFromOld(oldPlaybackSessionObj: any) {
    const playbackSession = this.getFromOld(oldPlaybackSessionObj)
    return this.update(playbackSession, {
      where: {
        id: playbackSession.id
      },
      silent: true
    })
  }

  static getFromOld(oldPlaybackSessionObj: any) {
    return {
      id: oldPlaybackSessionObj.id,
      mediaItemId: oldPlaybackSessionObj.bookId,
      mediaItemType: 'book',
      libraryId: oldPlaybackSessionObj.libraryId,
      displayTitle: oldPlaybackSessionObj.displayTitle,
      displayAuthor: oldPlaybackSessionObj.displayAuthor,
      duration: oldPlaybackSessionObj.duration,
      playMethod: oldPlaybackSessionObj.playMethod,
      mediaPlayer: oldPlaybackSessionObj.mediaPlayer,
      startTime: oldPlaybackSessionObj.startTime,
      currentTime: oldPlaybackSessionObj.currentTime,
      serverVersion: oldPlaybackSessionObj.serverVersion || null,
      createdAt: oldPlaybackSessionObj.startedAt,
      updatedAt: oldPlaybackSessionObj.updatedAt,
      userId: oldPlaybackSessionObj.userId,
      deviceId: oldPlaybackSessionObj.deviceInfo?.id || null,
      timeListening: oldPlaybackSessionObj.timeListening,
      coverPath: oldPlaybackSessionObj.coverPath,
      mediaMetadata: oldPlaybackSessionObj.mediaMetadata,
      date: oldPlaybackSessionObj.date,
      dayOfWeek: oldPlaybackSessionObj.dayOfWeek,
      extraData: {
        libraryItemId: oldPlaybackSessionObj.libraryItemId
      }
    }
  }

  getMediaItem(options?: any) {
    if (!this.mediaItemType) return Promise.resolve(null)
    const mixinMethodName = `get${(this.sequelize as any).uppercaseFirst(this.mediaItemType)}`
    return (this as any)[mixinMethodName](options)
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
        mediaItemId: DataTypes.UUID,
        mediaItemType: DataTypes.STRING,
        displayTitle: DataTypes.STRING,
        displayAuthor: DataTypes.STRING,
        duration: DataTypes.FLOAT,
        playMethod: DataTypes.INTEGER,
        mediaPlayer: DataTypes.STRING,
        startTime: DataTypes.FLOAT,
        currentTime: DataTypes.FLOAT,
        serverVersion: DataTypes.STRING,
        coverPath: DataTypes.STRING,
        timeListening: DataTypes.INTEGER,
        mediaMetadata: DataTypes.JSON,
        date: DataTypes.STRING,
        dayOfWeek: DataTypes.STRING,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'playbackSession'
      }
    )

    const { book, user, device, library } = sequelize.models

    user.hasMany(PlaybackSession)
    PlaybackSession.belongsTo(user)

    device.hasMany(PlaybackSession)
    PlaybackSession.belongsTo(device)

    library.hasMany(PlaybackSession)
    PlaybackSession.belongsTo(library)

    book.hasMany(PlaybackSession, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    PlaybackSession.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    PlaybackSession.addHook('afterFind', (findResult: any) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]

      for (const instance of findResult) {
        if (instance.book !== undefined) {
          instance.mediaItem = instance.book
          instance.dataValues.mediaItem = instance.dataValues.book
        }
        delete instance.book
        delete instance.dataValues.book
      }
    })
  }
}

export = PlaybackSession
