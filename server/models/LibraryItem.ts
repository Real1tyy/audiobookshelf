import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, NonAttribute, Sequelize } from 'sequelize'

const Path = require('path')
const fsExtra = require('../libs/fsExtra')
const Logger = require('../Logger')
const libraryFilters = require('../utils/queries/libraryFilters')
const { filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')
const LibraryFile = require('../objects/files/LibraryFile')
const Book = require('./Book')
const transcriptIndexer = require('../utils/transcriptIndexer')

/**
 * @typedef LibraryFileObject
 * @property {string} ino
 * @property {boolean} isSupplementary
 * @property {number} addedAt
 * @property {number} updatedAt
 * @property {{filename:string, ext:string, path:string, relPath:string, size:number, mtimeMs:number, ctimeMs:number, birthtimeMs:number}} metadata
 */

/**
 * @typedef LibraryItemExpandedProperties
 * @property {Book.BookExpanded} media
 *
 * @typedef {LibraryItem & LibraryItemExpandedProperties} LibraryItemExpanded
 */

class LibraryItem extends Model<InferAttributes<LibraryItem>, InferCreationAttributes<LibraryItem>> {
  declare id: CreationOptional<string>
  declare ino: string | null
  declare path: string | null
  declare relPath: string | null
  declare mediaId: string
  declare mediaType: string
  declare isFile: boolean | null
  declare isMissing: boolean | null
  declare isInvalid: boolean | null
  declare mtime: Date | null
  declare ctime: Date | null
  declare birthtime: Date | null
  declare size: number | null
  declare lastScan: Date | null
  declare lastScanVersion: string | null
  declare libraryFiles: any[]
  declare extraData: any | null
  declare libraryId: ForeignKey<string>
  declare libraryFolderId: ForeignKey<string>
  declare title: string | null
  declare titleIgnorePrefix: string | null
  declare authorNamesFirstLast: string | null
  declare authorNamesLastFirst: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties
  declare media?: NonAttribute<any>

  static getLibraryItemsIncrement(offset: number, limit: number, where: any = null) {
    return this.findAll({
      where,
      include: [
        {
          model: this.sequelize!.models.book,
          include: [
            {
              model: this.sequelize!.models.author,
              through: {
                attributes: ['createdAt']
              }
            },
            {
              model: this.sequelize!.models.series,
              through: {
                attributes: ['id', 'sequence', 'createdAt']
              }
            }
          ]
        }
      ],
      order: [
        ['createdAt', 'ASC'],
        [this.sequelize!.models.book, this.sequelize!.models.author, this.sequelize!.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize!.models.book, this.sequelize!.models.series, 'bookSeries', 'createdAt', 'ASC']
      ],
      offset,
      limit
    })
  }

  static removeById(libraryItemId: string) {
    return this.destroy({
      where: {
        id: libraryItemId
      },
      individualHooks: true
    })
  }

  static async findAllExpandedWhere(where: any = null) {
    return this.findAll({
      where,
      include: [
        {
          model: this.sequelize!.models.book,
          include: [
            {
              model: this.sequelize!.models.author,
              through: {
                attributes: []
              }
            },
            {
              model: this.sequelize!.models.series,
              through: {
                attributes: ['id', 'sequence']
              }
            }
          ]
        }
      ],
      order: [
        [this.sequelize!.models.book, this.sequelize!.models.author, this.sequelize!.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize!.models.book, this.sequelize!.models.series, 'bookSeries', 'createdAt', 'ASC']
      ]
    })
  }

  static async getExpandedById(libraryItemId: string) {
    if (!libraryItemId) return null

    const libraryItem = await this.findByPk(libraryItemId)
    if (!libraryItem) {
      Logger.error(`[LibraryItem] Library item not found with id "${libraryItemId}"`)
      return null
    }

    libraryItem.media = await libraryItem.getMedia({
      include: [
        {
          model: this.sequelize!.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: this.sequelize!.models.series,
          through: {
            attributes: ['id', 'sequence']
          }
        }
      ],
      order: [
        [this.sequelize!.models.author, this.sequelize!.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize!.models.series, 'bookSeries', 'createdAt', 'ASC']
      ]
    })

    if (!libraryItem.media) return null
    return libraryItem
  }

  static async findOneExpanded(where: any, replacements: any = null, include: any = null) {
    const libraryItem = await this.findOne({
      where,
      replacements,
      include
    })
    if (!libraryItem) {
      return null
    }

    libraryItem.media = await libraryItem.getMedia({
      include: [
        {
          model: this.sequelize!.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: this.sequelize!.models.series,
          through: {
            attributes: ['id', 'sequence']
          }
        }
      ],
      order: [
        [this.sequelize!.models.author, this.sequelize!.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize!.models.series, 'bookSeries', 'createdAt', 'ASC']
      ]
    })

    if (!libraryItem.media) return null
    return libraryItem
  }

  static async getByFilterAndSort(library: any, user: any, options: any) {
    let start = Date.now()
    const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(library.id, user, options)
    Logger.debug(`Loaded ${libraryItems.length} of ${count} items for libary page in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    return {
      libraryItems: libraryItems.map((li: any) => {
        const oldLibraryItem = li.toOldJSONMinified()
        if (li.collapsedSeries) {
          oldLibraryItem.collapsedSeries = li.collapsedSeries
        }
        if (li.series) {
          oldLibraryItem.media.metadata.series = li.series
        }
        if (li.size && !oldLibraryItem.media.size) {
          oldLibraryItem.media.size = li.size
        }
        if (li.mediaItemShare) {
          oldLibraryItem.mediaItemShare = li.mediaItemShare
        }

        return oldLibraryItem
      }),
      count
    }
  }

  static async getPersonalizedShelves(library: any, user: any, include: string[], limit: number) {
    const fullStart = Date.now()

    const shelves: any[] = []

    const itemsInProgressPayload = await libraryFilters.getMediaItemsInProgress(library, user, include, limit, false)
    if (itemsInProgressPayload.items.length) {
      const ebookOnlyItemsInProgress = itemsInProgressPayload.items.filter((li: any) => li.media.ebookFormat && !li.media.numTracks)
      const audioItemsInProgress = itemsInProgressPayload.items.filter((li: any) => li.media.numTracks)

      if (audioItemsInProgress.length) {
        shelves.push({
          id: 'continue-listening',
          label: 'Continue Listening',
          labelStringKey: 'LabelContinueListening',
          type: 'book',
          entities: audioItemsInProgress,
          total: itemsInProgressPayload.count
        })
      }

      if (ebookOnlyItemsInProgress.length) {
        shelves.push({
          id: 'continue-reading',
          label: 'Continue Reading',
          labelStringKey: 'LabelContinueReading',
          type: 'book',
          entities: ebookOnlyItemsInProgress,
          total: itemsInProgressPayload.count
        })
      }
    }
    Logger.debug(`Loaded ${itemsInProgressPayload.items.length} of ${itemsInProgressPayload.count} items for "Continue Listening/Reading" in ${((Date.now() - fullStart) / 1000).toFixed(2)}s`)

    let start = Date.now()
    if (library.isBook) {
      start = Date.now()
      const continueSeriesPayload = await libraryFilters.getLibraryItemsContinueSeries(library, user, include, limit)
      if (continueSeriesPayload.libraryItems.length) {
        shelves.push({
          id: 'continue-series',
          label: 'Continue Series',
          labelStringKey: 'LabelContinueSeries',
          type: 'book',
          entities: continueSeriesPayload.libraryItems,
          total: continueSeriesPayload.count
        })
      }
      Logger.debug(`Loaded ${continueSeriesPayload.libraryItems.length} of ${continueSeriesPayload.count} items for "Continue Series" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    }

    start = Date.now()
    const mostRecentPayload = await libraryFilters.getLibraryItemsMostRecentlyAdded(library, user, include, limit)
    if (mostRecentPayload.libraryItems.length) {
      shelves.push({
        id: 'recently-added',
        label: 'Recently Added',
        labelStringKey: 'LabelRecentlyAdded',
        type: library.mediaType,
        entities: mostRecentPayload.libraryItems,
        total: mostRecentPayload.count
      })
    }
    Logger.debug(`Loaded ${mostRecentPayload.libraryItems.length} of ${mostRecentPayload.count} items for "Recently Added" in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    if (library.isBook) {
      start = Date.now()
      const seriesMostRecentPayload = await libraryFilters.getSeriesMostRecentlyAdded(library, user, include, 5)
      if (seriesMostRecentPayload.series.length) {
        shelves.push({
          id: 'recent-series',
          label: 'Recent Series',
          labelStringKey: 'LabelRecentSeries',
          type: 'series',
          entities: seriesMostRecentPayload.series,
          total: seriesMostRecentPayload.count
        })
      }
      Logger.debug(`Loaded ${seriesMostRecentPayload.series.length} of ${seriesMostRecentPayload.count} series for "Recent Series" in ${((Date.now() - start) / 1000).toFixed(2)}s`)

      start = Date.now()
      const discoverLibraryItemsPayload = await libraryFilters.getLibraryItemsToDiscover(library, user, include, limit)
      if (discoverLibraryItemsPayload.libraryItems.length) {
        shelves.push({
          id: 'discover',
          label: 'Discover',
          labelStringKey: 'LabelDiscover',
          type: library.mediaType,
          entities: discoverLibraryItemsPayload.libraryItems,
          total: discoverLibraryItemsPayload.count
        })
      }
      Logger.debug(`Loaded ${discoverLibraryItemsPayload.libraryItems.length} of ${discoverLibraryItemsPayload.count} items for "Discover" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    }

    start = Date.now()
    const mediaFinishedPayload = await libraryFilters.getMediaFinished(library, user, include, limit)
    if (mediaFinishedPayload.items.length) {
      const ebookOnlyItemsInProgress = mediaFinishedPayload.items.filter((li: any) => li.media.ebookFormat && !li.media.numTracks)
      const audioItemsInProgress = mediaFinishedPayload.items.filter((li: any) => li.media.numTracks)

      if (audioItemsInProgress.length) {
        shelves.push({
          id: 'listen-again',
          label: 'Listen Again',
          labelStringKey: 'LabelListenAgain',
          type: 'book',
          entities: audioItemsInProgress,
          total: mediaFinishedPayload.count
        })
      }

      if (ebookOnlyItemsInProgress.length) {
        shelves.push({
          id: 'read-again',
          label: 'Read Again',
          labelStringKey: 'LabelReadAgain',
          type: 'book',
          entities: ebookOnlyItemsInProgress,
          total: mediaFinishedPayload.count
        })
      }
    }
    Logger.debug(`Loaded ${mediaFinishedPayload.items.length} of ${mediaFinishedPayload.count} items for "Listen/Read Again" in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    if (library.isBook) {
      start = Date.now()
      const newestAuthorsPayload = await libraryFilters.getNewestAuthors(library, user, limit)
      if (newestAuthorsPayload.authors.length) {
        shelves.push({
          id: 'newest-authors',
          label: 'Newest Authors',
          labelStringKey: 'LabelNewestAuthors',
          type: 'authors',
          entities: newestAuthorsPayload.authors,
          total: newestAuthorsPayload.count
        })
      }
      Logger.debug(`Loaded ${newestAuthorsPayload.authors.length} of ${newestAuthorsPayload.count} authors for "Newest Authors" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    }

    Logger.debug(`Loaded ${shelves.length} personalized shelves in ${((Date.now() - fullStart) / 1000).toFixed(2)}s`)

    return shelves
  }

  static async getForAuthor(author: any, user: any = null) {
    const { libraryItems } = await libraryFilters.getLibraryItemsForAuthor(author, user, undefined, undefined)
    return libraryItems
  }

  static async checkExistsById(libraryItemId: string): Promise<boolean> {
    return (await this.count({ where: { id: libraryItemId } })) > 0
  }

  static async getCoverPath(libraryItemId: string): Promise<string | null> {
    const libraryItem = await this.findByPk(libraryItemId, {
      attributes: ['id', 'mediaType', 'mediaId', 'libraryId'],
      include: [
        {
          model: this.sequelize!.models.book,
          attributes: ['id', 'coverPath']
        }
      ]
    })
    if (!libraryItem) {
      Logger.warn(`[LibraryItem] getCoverPath: Library item "${libraryItemId}" does not exist`)
      return null
    }

    return libraryItem.media.coverPath
  }

  async saveMetadataFile() {
    let metadataPath = Path.join(global.MetadataPath, 'items', this.id)
    let storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem
    if (storeMetadataWithItem && !this.isFile && this.path) {
      metadataPath = this.path
    } else {
      storeMetadataWithItem = false
      await fsExtra.ensureDir(metadataPath)
    }

    const metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)

    let mediaExpanded = this.media
    if (!mediaExpanded || !mediaExpanded.authors || !mediaExpanded.series) {
      mediaExpanded = await this.getMedia({
        include: [
          {
            model: this.sequelize!.models.author,
            through: {
              attributes: []
            }
          },
          {
            model: this.sequelize!.models.series,
            through: {
              attributes: ['id', 'sequence']
            }
          }
        ],
        order: [
          [this.sequelize!.models.author, this.sequelize!.models.bookAuthor, 'createdAt', 'ASC'],
          [this.sequelize!.models.series, 'bookSeries', 'createdAt', 'ASC']
        ]
      })
    }

    const jsonObject = {
      tags: mediaExpanded.tags || [],
      chapters: mediaExpanded.chapters?.map((c: any) => ({ ...c })) || [],
      title: mediaExpanded.title,
      subtitle: mediaExpanded.subtitle,
      authors: mediaExpanded.authors.map((a: any) => a.name),
      series: mediaExpanded.series.map((se: any) => {
        const sequence = se.bookSeries?.sequence || ''
        if (!sequence) return se.name
        return `${se.name} #${sequence}`
      }),
      genres: mediaExpanded.genres || [],
      publishedYear: mediaExpanded.publishedYear,
      publishedDate: mediaExpanded.publishedDate,
      publisher: mediaExpanded.publisher,
      description: mediaExpanded.description,
      isbn: mediaExpanded.isbn,
      asin: mediaExpanded.asin,
      language: mediaExpanded.language,
      explicit: !!mediaExpanded.explicit,
      abridged: !!mediaExpanded.abridged,
      rating: mediaExpanded.rating,
      url: mediaExpanded.url,
      relatedBooks: mediaExpanded.relatedBooks || []
    }

    return fsExtra
      .writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2))
      .then(async () => {
        let metadataLibraryFile = this.libraryFiles.find((lf: any) => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            const newLibraryFile = new LibraryFile()
            await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.json`)
            metadataLibraryFile = newLibraryFile.toJSON()
            this.libraryFiles.push(metadataLibraryFile)
          } else {
            const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
            if (fileTimestamps) {
              metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
              metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
              metadataLibraryFile.metadata.size = fileTimestamps.size
              metadataLibraryFile.ino = fileTimestamps.ino
            }
          }
          const libraryItemDirTimestamps = await getFileTimestampsWithIno(this.path)
          if (libraryItemDirTimestamps) {
            this.mtime = libraryItemDirTimestamps.mtimeMs
            this.ctime = libraryItemDirTimestamps.ctimeMs
            let size = 0
            this.libraryFiles.forEach((lf: any) => (size += !isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
            this.size = size
            await this.save()
          }
        }

        Logger.debug(`[LibraryItem] Saved metadata for "${this.media?.title || 'Unknown'}" file to "${metadataFilePath}"`)

        return metadataLibraryFile
      })
      .catch((error: Error) => {
        Logger.error(`Failed to save json file at "${metadataFilePath}"`, error)
        return null
      })
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
        ino: DataTypes.STRING,
        path: DataTypes.STRING,
        relPath: DataTypes.STRING,
        mediaId: DataTypes.UUID,
        mediaType: DataTypes.STRING,
        isFile: DataTypes.BOOLEAN,
        isMissing: DataTypes.BOOLEAN,
        isInvalid: DataTypes.BOOLEAN,
        mtime: DataTypes.DATE(6),
        ctime: DataTypes.DATE(6),
        birthtime: DataTypes.DATE(6),
        size: DataTypes.BIGINT,
        lastScan: DataTypes.DATE,
        lastScanVersion: DataTypes.STRING,
        libraryFiles: DataTypes.JSON,
        extraData: DataTypes.JSON,
        title: DataTypes.STRING,
        titleIgnorePrefix: DataTypes.STRING,
        authorNamesFirstLast: DataTypes.STRING,
        authorNamesLastFirst: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'libraryItem',
        indexes: [
          {
            fields: ['createdAt']
          },
          {
            fields: ['mediaId']
          },
          {
            fields: ['libraryId', 'mediaType']
          },
          {
            fields: ['libraryId', 'mediaType', 'size']
          },
          {
            fields: ['libraryId', 'mediaType', 'createdAt']
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'title', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'titleIgnorePrefix', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'authorNamesFirstLast', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'authorNamesLastFirst', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaId', 'mediaType']
          },
          {
            fields: ['birthtime']
          },
          {
            fields: ['mtime']
          }
        ]
      }
    )

    const { library, libraryFolder, book } = sequelize.models
    library.hasMany(LibraryItem)
    LibraryItem.belongsTo(library)

    libraryFolder.hasMany(LibraryItem)
    LibraryItem.belongsTo(libraryFolder)

    book.hasOne(LibraryItem, {
      foreignKey: 'mediaId',
      constraints: false,
      scope: {
        mediaType: 'book'
      }
    })
    LibraryItem.belongsTo(book, { foreignKey: 'mediaId', constraints: false })

    LibraryItem.addHook('afterFind', (findResult: any) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]
      for (const instance of findResult) {
        if (instance.book !== undefined) {
          instance.media = instance.book
          instance.dataValues.media = instance.dataValues.book
        }
        delete instance.book
        delete instance.dataValues.book
      }
    })

    LibraryItem.addHook('afterDestroy', async (instance: any) => {
      if (!instance) return
      const media = await instance.getMedia()
      if (media) {
        media.destroy()
      }
      transcriptIndexer.removeTranscript(instance.id).catch((err: Error) => {
        Logger.error(`[LibraryItem] Failed to remove transcript FTS entry for ${instance.id}`, err)
      })
    })
  }

  get isBook(): boolean {
    return this.mediaType === 'book'
  }

  get hasAudioTracks(): boolean {
    return this.media.hasAudioTracks()
  }

  getMedia(options?: any) {
    if (!this.mediaType) return Promise.resolve(null)
    const mixinMethodName = `get${(this.sequelize as any).uppercaseFirst(this.mediaType)}`
    return (this as any)[mixinMethodName](options)
  }

  getMediaExpanded() {
    return this.getMedia({
      include: [
        {
          model: this.sequelize!.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: this.sequelize!.models.series,
          through: {
            attributes: ['sequence']
          }
        }
      ],
      order: [
        [this.sequelize!.models.author, this.sequelize!.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize!.models.series, 'bookSeries', 'createdAt', 'ASC']
      ]
    })
  }

  hasAudioTracksMethod(): boolean {
    if (!this.media) {
      Logger.error(`[LibraryItem] hasAudioTracks: Library item "${this.id}" does not have media`)
      return false
    }
    return this.media.audioFiles?.length > 0
  }

  getAudioFileWithIno(ino: string) {
    if (!this.media) {
      Logger.error(`[LibraryItem] getAudioFileWithIno: Library item "${this.id}" does not have media`)
      return null
    }
    return this.media.audioFiles.find((af: any) => af.ino === ino)
  }

  getTrackList() {
    if (!this.media) {
      Logger.error(`[LibraryItem] getTrackList: Library item "${this.id}" does not have media`)
      return []
    }
    return this.media.getTracklist(this.id)
  }

  getLibraryFileWithIno(ino: string) {
    const libraryFile = this.libraryFiles.find((lf: any) => lf.ino === ino)
    if (!libraryFile) return null
    return new LibraryFile(libraryFile)
  }

  getLibraryFiles() {
    return this.libraryFiles.map((lf: any) => new LibraryFile(lf))
  }

  getLibraryFilesJson() {
    return this.libraryFiles.map((lf: any) => new LibraryFile(lf).toJSON())
  }

  toOldJSON() {
    if (!this.media) {
      throw new Error(`[LibraryItem] Cannot convert to old JSON without media for library item "${this.id}"`)
    }

    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.extraData?.oldLibraryItemId || null,
      libraryId: this.libraryId,
      folderId: this.libraryFolderId,
      path: this.path,
      relPath: this.relPath,
      isFile: this.isFile,
      mtimeMs: this.mtime?.valueOf(),
      ctimeMs: this.ctime?.valueOf(),
      birthtimeMs: this.birthtime?.valueOf(),
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      lastScan: this.lastScan?.valueOf(),
      scanVersion: this.lastScanVersion,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toOldJSON(this.id),
      libraryFiles: this.getLibraryFilesJson()
    }
  }

  toOldJSONMinified() {
    if (!this.media) {
      throw new Error(`[LibraryItem] Cannot convert to old JSON without media for library item "${this.id}"`)
    }

    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.extraData?.oldLibraryItemId || null,
      libraryId: this.libraryId,
      folderId: this.libraryFolderId,
      path: this.path,
      relPath: this.relPath,
      isFile: this.isFile,
      mtimeMs: this.mtime?.valueOf(),
      ctimeMs: this.ctime?.valueOf(),
      birthtimeMs: this.birthtime?.valueOf(),
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toOldJSONMinified(),
      numFiles: this.libraryFiles.length,
      size: this.size
    }
  }

  toOldJSONExpanded() {
    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.extraData?.oldLibraryItemId || null,
      libraryId: this.libraryId,
      folderId: this.libraryFolderId,
      path: this.path,
      relPath: this.relPath,
      isFile: this.isFile,
      mtimeMs: this.mtime?.valueOf(),
      ctimeMs: this.ctime?.valueOf(),
      birthtimeMs: this.birthtime?.valueOf(),
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      lastScan: this.lastScan?.valueOf(),
      scanVersion: this.lastScanVersion,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toOldJSONExpanded(this.id),
      libraryFiles: this.getLibraryFilesJson(),
      size: this.size
    }
  }
}

export = LibraryItem
