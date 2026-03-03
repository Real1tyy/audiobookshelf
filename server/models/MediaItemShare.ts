import { DataTypes, FindOptions, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, NonAttribute, Sequelize } from 'sequelize'
import type { MediaItemShareExtraData } from './types'

class MediaItemShare extends Model<InferAttributes<MediaItemShare, { omit: 'mediaItem' }>, InferCreationAttributes<MediaItemShare, { omit: 'mediaItem' }>> {
  declare id: CreationOptional<string>
  declare mediaItemId: string
  declare mediaItemType: string
  declare slug: string
  declare pash: CreationOptional<string | null>
  declare userId: ForeignKey<string>
  declare expiresAt: CreationOptional<Date | null>
  declare extraData: CreationOptional<MediaItemShareExtraData | null>
  declare isDownloadable: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded property set by afterFind hook
  declare mediaItem: NonAttribute<any>

  toJSONForClient() {
    return {
      id: this.id,
      mediaItemId: this.mediaItemId,
      mediaItemType: this.mediaItemType,
      slug: this.slug,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isDownloadable: this.isDownloadable
    }
  }

  /**
   * Expanded book that includes library settings
   */
  static async getMediaItemsLibraryItem(mediaItemId: string, mediaItemType: string) {
    const libraryItemModel = this.sequelize!.models.libraryItem as any

    if (mediaItemType === 'book') {
      const libraryItem = await libraryItemModel.findOneExpanded({ mediaId: mediaItemId }, null, {
        model: this.sequelize!.models.library,
        attributes: ['settings']
      })

      return libraryItem
    }
    return null
  }

  getMediaItem(options?: FindOptions) {
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
        slug: DataTypes.STRING,
        pash: DataTypes.STRING,
        expiresAt: DataTypes.DATE,
        extraData: DataTypes.JSON,
        isDownloadable: DataTypes.BOOLEAN
      },
      {
        sequelize,
        modelName: 'mediaItemShare'
      }
    )

    const { user, book, podcastEpisode } = sequelize.models

    user.hasMany(MediaItemShare)
    MediaItemShare.belongsTo(user)

    book.hasMany(MediaItemShare, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    MediaItemShare.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    podcastEpisode.hasOne(MediaItemShare, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'podcastEpisode'
      }
    })
    MediaItemShare.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

    MediaItemShare.addHook('afterFind', (findResult: any) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]

      for (const instance of findResult) {
        if (instance.mediaItemType === 'book' && instance.book !== undefined) {
          instance.mediaItem = instance.book
          instance.dataValues.mediaItem = instance.dataValues.book
        } else if (instance.mediaItemType === 'podcastEpisode' && instance.podcastEpisode !== undefined) {
          instance.mediaItem = instance.podcastEpisode
          instance.dataValues.mediaItem = instance.dataValues.podcastEpisode
        }
        // To prevent mistakes:
        delete instance.book
        delete instance.dataValues.book
        delete instance.podcastEpisode
        delete instance.dataValues.podcastEpisode
      }
    })
  }
}

export = MediaItemShare
