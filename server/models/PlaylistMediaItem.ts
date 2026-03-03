import { DataTypes, FindOptions, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, NonAttribute, Sequelize } from 'sequelize'

class PlaylistMediaItem extends Model<InferAttributes<PlaylistMediaItem, { omit: 'mediaItem' }>, InferCreationAttributes<PlaylistMediaItem, { omit: 'mediaItem' }>> {
  declare id: CreationOptional<string>
  declare mediaItemId: string
  declare mediaItemType: string
  declare order: number
  declare playlistId: ForeignKey<string>
  declare createdAt: CreationOptional<Date>

  // Expanded property set by afterFind hook
  declare mediaItem: NonAttribute<any>

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
        order: DataTypes.INTEGER
      },
      {
        sequelize,
        timestamps: true,
        updatedAt: false,
        modelName: 'playlistMediaItem'
      }
    )

    const { book, podcastEpisode, playlist } = sequelize.models

    book.hasMany(PlaylistMediaItem, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    PlaylistMediaItem.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    podcastEpisode.hasOne(PlaylistMediaItem, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'podcastEpisode'
      }
    })
    PlaylistMediaItem.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

    PlaylistMediaItem.addHook('afterFind', (findResult: any) => {
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

    playlist.hasMany(PlaylistMediaItem, {
      onDelete: 'CASCADE'
    })
    PlaylistMediaItem.belongsTo(playlist)
  }
}

export = PlaylistMediaItem
