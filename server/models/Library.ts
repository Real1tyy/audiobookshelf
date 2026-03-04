import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, Sequelize } from 'sequelize'

const Logger = require('../Logger')

interface LibrarySettingsObject {
  coverAspectRatio: number
  disableWatcher: boolean
  skipMatchingMediaWithAsin: boolean
  skipMatchingMediaWithIsbn: boolean
  autoScanCronExpression: string | null
  audiobooksOnly: boolean
  hideSingleBookSeries: boolean
  onlyShowLaterBooksInContinueSeries: boolean
  metadataPrecedence: string[]
  markAsFinishedTimeRemaining: number
  markAsFinishedPercentComplete: number | null
}

class Library extends Model<InferAttributes<Library>, InferCreationAttributes<Library>> {
  declare id: CreationOptional<string>
  declare name: string
  declare displayOrder: number
  declare icon: string | null
  declare mediaType: string
  declare provider: string | null
  declare lastScan: Date | null
  declare lastScanVersion: string | null
  declare settings: LibrarySettingsObject | null
  declare extraData: any | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties
  declare libraryFolders?: NonAttribute<any[]>

  static getDefaultLibrarySettingsForMediaType(_mediaType: string): LibrarySettingsObject {
    return {
      coverAspectRatio: 1,
      disableWatcher: false,
      autoScanCronExpression: null,
      skipMatchingMediaWithAsin: false,
      skipMatchingMediaWithIsbn: false,
      audiobooksOnly: false,
      hideSingleBookSeries: false,
      onlyShowLaterBooksInContinueSeries: false,
      metadataPrecedence: this.defaultMetadataPrecedence,
      markAsFinishedPercentComplete: null,
      markAsFinishedTimeRemaining: 10
    }
  }

  static get defaultMetadataPrecedence(): string[] {
    return ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata']
  }

  static getAllWithFolders() {
    return this.findAll({
      include: this.sequelize!.models.libraryFolder,
      order: [['displayOrder', 'ASC']]
    })
  }

  static findByIdWithFolders(libraryId: string) {
    return this.findByPk(libraryId, {
      include: this.sequelize!.models.libraryFolder
    })
  }

  static async getAllLibraryIds(): Promise<string[]> {
    const libraries = await this.findAll({
      attributes: ['id', 'displayOrder'],
      order: [['displayOrder', 'ASC']]
    })
    return libraries.map((l) => l.id)
  }

  static getMaxDisplayOrder() {
    return this.max('displayOrder') || 0
  }

  static async resetDisplayOrder() {
    const libraries = await this.findAll({
      order: [['displayOrder', 'ASC']]
    })
    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i]
      if (library.displayOrder !== i + 1) {
        Logger.debug(`[Library] Updating display order of library from ${library.displayOrder} to ${i + 1}`)
        await library.update({ displayOrder: i + 1 }).catch((error: Error) => {
          Logger.error(`[Library] Failed to update library display order to ${i + 1}`, error)
        })
      }
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
        name: DataTypes.STRING,
        displayOrder: DataTypes.INTEGER,
        icon: DataTypes.STRING,
        mediaType: DataTypes.STRING,
        provider: DataTypes.STRING,
        lastScan: DataTypes.DATE,
        lastScanVersion: DataTypes.STRING,
        settings: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'library'
      }
    )
  }

  get isBook(): boolean {
    return this.mediaType === 'book'
  }

  get lastScanMetadataPrecedence(): string[] {
    return this.extraData?.lastScanMetadataPrecedence || []
  }

  get librarySettings(): LibrarySettingsObject {
    return this.settings || Library.getDefaultLibrarySettingsForMediaType(this.mediaType)
  }

  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      folders: (this.libraryFolders || []).map((f: any) => f.toOldJSON()),
      displayOrder: this.displayOrder,
      icon: this.icon,
      mediaType: this.mediaType,
      provider: this.provider,
      settings: {
        ...this.settings
      },
      lastScan: this.lastScan?.valueOf() || null,
      lastScanVersion: this.lastScanVersion,
      createdAt: this.createdAt.valueOf(),
      lastUpdate: this.updatedAt.valueOf()
    }
  }
}

export = Library
