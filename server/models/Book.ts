import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, Sequelize } from 'sequelize'

const Logger = require('../Logger')
const { getTitlePrefixAtEnd, getTitleIgnorePrefix } = require('../utils')
const parseNameString = require('../utils/parsers/parseNameString')
const htmlSanitizer = require('../utils/htmlSanitizer')
const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

/**
 * @typedef EBookFileObject
 * @property {string} ino
 * @property {string} ebookFormat
 * @property {number} addedAt
 * @property {number} updatedAt
 * @property {{filename:string, ext:string, path:string, relPath:string, size:number, mtimeMs:number, ctimeMs:number, birthtimeMs:number}} metadata
 */

/**
 * @typedef ChapterObject
 * @property {number} id
 * @property {number} start
 * @property {number} end
 * @property {string} title
 */

/**
 * @typedef SeriesExpandedProperties
 * @property {{sequence:string}} bookSeries
 *
 * @typedef {import('./Series') & SeriesExpandedProperties} SeriesExpanded
 *
 * @typedef BookExpandedProperties
 * @property {import('./Author')[]} authors
 * @property {SeriesExpanded[]} series
 *
 * @typedef {Book & BookExpandedProperties} BookExpanded
 *
 * @typedef BookExpandedWithLibraryItemProperties
 * @property {import('./LibraryItem')} libraryItem
 *
 * @typedef {BookExpanded & BookExpandedWithLibraryItemProperties} BookExpandedWithLibraryItem
 */

/**
 * @typedef AudioFileObject
 * @property {number} index
 * @property {string} ino
 * @property {{filename:string, ext:string, path:string, relPath:string, size:number, mtimeMs:number, ctimeMs:number, birthtimeMs:number}} metadata
 * @property {number} addedAt
 * @property {number} updatedAt
 * @property {number} trackNumFromMeta
 * @property {number} discNumFromMeta
 * @property {number} trackNumFromFilename
 * @property {number} discNumFromFilename
 * @property {boolean} manuallyVerified
 * @property {string} format
 * @property {number} duration
 * @property {number} bitRate
 * @property {string} language
 * @property {string} codec
 * @property {string} timeBase
 * @property {number} channels
 * @property {string} channelLayout
 * @property {ChapterObject[]} chapters
 * @property {Object} metaTags
 * @property {string} mimeType
 *
 * @typedef AudioTrackProperties
 * @property {string} title
 * @property {string} contentUrl
 * @property {number} startOffset
 *
 * @typedef {AudioFileObject & AudioTrackProperties} AudioTrack
 */

class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
  declare id: CreationOptional<string>
  declare title: string | null
  declare titleIgnorePrefix: string | null
  declare subtitle: string | null
  declare publishedYear: string | null
  declare publishedDate: string | null
  declare publisher: string | null
  declare description: string | null
  declare isbn: string | null
  declare asin: string | null
  declare language: string | null
  declare explicit: boolean | null
  declare abridged: boolean | null
  declare coverPath: string | null
  declare duration: number | null
  declare rating: number | null
  declare url: any | null
  declare relatedBooks: string[] | null
  declare viewedCount: CreationOptional<number>
  declare totalListeningTime: CreationOptional<number>
  declare audioFiles: any[]
  declare ebookFile: any | null
  declare chapters: any[] | null
  declare tags: string[] | null
  declare genres: string[] | null
  declare transcript: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties
  declare authors?: NonAttribute<any[]>
  declare series?: NonAttribute<any[]>
  declare mediaProgresses?: NonAttribute<any[]>

  static init(...args: any[]): any {
    const sequelize = args[0] as Sequelize
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        title: DataTypes.STRING,
        titleIgnorePrefix: DataTypes.STRING,
        subtitle: DataTypes.STRING,
        publishedYear: DataTypes.STRING,
        publishedDate: DataTypes.STRING,
        publisher: DataTypes.STRING,
        description: DataTypes.TEXT,
        isbn: DataTypes.STRING,
        asin: DataTypes.STRING,
        language: DataTypes.STRING,
        explicit: DataTypes.BOOLEAN,
        abridged: DataTypes.BOOLEAN,
        coverPath: DataTypes.STRING,
        duration: DataTypes.FLOAT,
        rating: DataTypes.FLOAT,
        url: DataTypes.JSON,
        relatedBooks: DataTypes.JSON,
        viewedCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        totalListeningTime: {
          type: DataTypes.FLOAT,
          allowNull: false,
          defaultValue: 0
        },
        audioFiles: DataTypes.JSON,
        ebookFile: DataTypes.JSON,
        chapters: DataTypes.JSON,
        tags: DataTypes.JSON,
        genres: DataTypes.JSON,
        transcript: DataTypes.TEXT
      },
      {
        sequelize,
        modelName: 'book',
        indexes: [
          {
            fields: [
              {
                name: 'title',
                collate: 'NOCASE'
              }
            ]
          },
          {
            fields: ['publishedYear']
          },
          {
            fields: ['duration']
          }
        ]
      }
    )

    Book.addHook('afterDestroy', async (_instance: any) => {
      libraryItemsBookFilters.clearCountCache('afterDestroy')
    })

    Book.addHook('afterCreate', async (_instance: any) => {
      libraryItemsBookFilters.clearCountCache('afterCreate')
    })

    Book.addHook('afterUpdate', async (instance: any, options: any) => {
      libraryItemsBookFilters.clearCountCache('afterUpdate')

      const changedFields: string[] = Array.isArray(options?.fields) ? options.fields : instance.changed() || []
      const metadataFields = ['title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language', 'explicit', 'abridged', 'rating', 'url', 'relatedBooks', 'genres', 'tags', 'chapters']
      const hasMetadataChanges = changedFields.some((field: string) => metadataFields.includes(field))

      if (hasMetadataChanges) {
        try {
          const libraryItem = await instance.sequelize.models.libraryItem.findOne({
            where: { mediaId: instance.id }
          })
          if (libraryItem) {
            await libraryItem.saveMetadataFile()
            Logger.debug(`[Book] Metadata file synced for "${instance.title}" after update`)
          }
        } catch (error: any) {
          Logger.error(`[Book] afterUpdate hook failed to save metadata file for book "${instance.title}":`, error)
        }
      }
    })
  }

  get authorName(): string {
    if (this.authors === undefined) {
      Logger.error(`[Book] authorName: Cannot get authorName because authors are not loaded`)
      return ''
    }
    return this.authors.map((au: any) => au.name).join(', ')
  }

  get authorNameLF(): string {
    if (this.authors === undefined) {
      Logger.error(`[Book] authorNameLF: Cannot get authorNameLF because authors are not loaded`)
      return ''
    }
    if (!this.authors.length) return ''
    return this.authors.map((au: any) => parseNameString.nameToLastFirst(au.name)).join(', ')
  }

  get seriesName(): string {
    if (this.series === undefined) {
      Logger.error(`[Book] seriesName: Cannot get seriesName because series are not loaded`)
      return ''
    }
    if (!this.series.length) return ''
    return this.series
      .map((se: any) => {
        const sequence = se.bookSeries?.sequence || ''
        if (!sequence) return se.name
        return `${se.name} #${sequence}`
      })
      .join(', ')
  }

  get includedAudioFiles(): any[] {
    return this.audioFiles.filter((af: any) => !af.exclude)
  }

  get hasMediaFiles(): boolean {
    return !!this.hasAudioTracks || !!this.ebookFile
  }

  get hasAudioTracks(): boolean {
    return !!this.includedAudioFiles.length
  }

  checkCanDirectPlay(supportedMimeTypes: string[]): boolean {
    if (!Array.isArray(supportedMimeTypes)) {
      Logger.error(`[Book] checkCanDirectPlay: supportedMimeTypes is not an array`, supportedMimeTypes)
      return false
    }
    return this.includedAudioFiles.every((af: any) => supportedMimeTypes.includes(af.mimeType))
  }

  getTracklist(libraryItemId: string) {
    let startOffset = 0
    return this.includedAudioFiles.map((af: any) => {
      const track = structuredClone(af)
      track.title = af.metadata.filename
      track.startOffset = startOffset
      track.contentUrl = `/api/items/${libraryItemId}/file/${track.ino}`
      startOffset += track.duration
      return track
    })
  }

  getChapters() {
    return structuredClone(this.chapters) || []
  }

  getPlaybackTitle(): string {
    return this.title || ''
  }

  getPlaybackAuthor(): string {
    return this.authorName
  }

  getPlaybackDuration(): number | null {
    return this.duration
  }

  get size(): number {
    let total = 0
    this.audioFiles.forEach((af: any) => (total += af.metadata.size))
    if (this.ebookFile) {
      total += this.ebookFile.metadata.size
    }
    return total
  }

  static flattenUrls(val: any): string[] {
    const result: string[] = []
    const process = (v: any) => {
      if (!v) return
      if (Array.isArray(v)) {
        v.forEach(process)
        return
      }
      if (typeof v === 'string') {
        const trimmed = v.trim()
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) {
              parsed.forEach(process)
              return
            }
          } catch {}
        }
        if (trimmed) result.push(trimmed)
      }
    }
    process(val)
    return result
  }

  getNormalizedUrls(): string[] {
    return Book.flattenUrls(this.url)
  }

  getAbsMetadataJson() {
    return {
      tags: this.tags || [],
      chapters: this.chapters?.map((c: any) => ({ ...c })) || [],
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors!.map((a: any) => a.name),
      series: this.series!.map((se: any) => {
        const sequence = se.bookSeries?.sequence || ''
        if (!sequence) return se.name
        return `${se.name} #${sequence}`
      }),
      genres: this.genres || [],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: !!this.explicit,
      abridged: !!this.abridged,
      rating: this.rating,
      url: this.getNormalizedUrls(),
      relatedBooks: this.relatedBooks || []
    }
  }

  async updateFromRequest(payload: any): Promise<boolean> {
    if (!payload) return false

    let hasUpdates = false

    if (payload.metadata) {
      const metadataStringKeys = ['title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language']
      metadataStringKeys.forEach((key) => {
        if (typeof payload.metadata[key] == 'number') {
          payload.metadata[key] = String(payload.metadata[key])
        }

        if ((typeof payload.metadata[key] === 'string' || payload.metadata[key] === null) && (this as any)[key] !== payload.metadata[key]) {
          if (key === 'description' && payload.metadata[key]) {
            const sanitizedDescription = htmlSanitizer.sanitize(payload.metadata[key])
            if (sanitizedDescription !== payload.metadata[key]) {
              Logger.debug(`[Book] "${this.title}" Sanitized description from "${payload.metadata[key]}" to "${sanitizedDescription}"`)
              payload.metadata[key] = sanitizedDescription
            }
          }

          ;(this as any)[key] = payload.metadata[key] || null

          if (key === 'title') {
            this.titleIgnorePrefix = getTitleIgnorePrefix(this.title)
          }

          hasUpdates = true
        }
      })
      if (payload.metadata.explicit !== undefined && this.explicit !== !!payload.metadata.explicit) {
        this.explicit = !!payload.metadata.explicit
        hasUpdates = true
      }
      if (payload.metadata.abridged !== undefined && this.abridged !== !!payload.metadata.abridged) {
        this.abridged = !!payload.metadata.abridged
        hasUpdates = true
      }
      if (payload.metadata.rating !== undefined) {
        const rating = payload.metadata.rating === null ? null : Number(payload.metadata.rating)
        if (rating !== null && (isNaN(rating) || rating < 0 || rating > 10)) {
          Logger.warn(`[Book] "${this.title}" Invalid rating value: ${payload.metadata.rating}. Must be between 0 and 10.`)
        } else if (this.rating !== rating) {
          this.rating = rating
          hasUpdates = true
        }
      }
      if (payload.metadata.relatedBooks !== undefined) {
        const relatedBooks = Array.isArray(payload.metadata.relatedBooks) ? payload.metadata.relatedBooks.filter((id: string) => typeof id === 'string' && id !== this.id) : []
        if (JSON.stringify(this.relatedBooks || []) !== JSON.stringify(relatedBooks)) {
          this.relatedBooks = relatedBooks
          this.changed('relatedBooks', true)
          hasUpdates = true
        }
      }
      const arrayOfStringsKeys = ['genres']
      arrayOfStringsKeys.forEach((key) => {
        if (Array.isArray(payload.metadata[key]) && !payload.metadata[key].some((item: any) => typeof item !== 'string') && JSON.stringify((this as any)[key]) !== JSON.stringify(payload.metadata[key])) {
          ;(this as any)[key] = payload.metadata[key]
          this.changed(key as any, true)
          hasUpdates = true
        }
      })

      if (payload.metadata.url !== undefined) {
        const newUrl = [...new Set(Book.flattenUrls(payload.metadata.url))]
        if (JSON.stringify(this.getNormalizedUrls()) !== JSON.stringify(newUrl)) {
          this.url = newUrl.length ? newUrl : null
          this.changed('url', true)
          hasUpdates = true
        }
      }
    }

    if (Array.isArray(payload.tags) && !payload.tags.some((tag: any) => typeof tag !== 'string') && JSON.stringify(this.tags) !== JSON.stringify(payload.tags)) {
      this.tags = payload.tags
      this.changed('tags', true)
      hasUpdates = true
    }

    const arrayOfObjectsKeys = ['audioFiles', 'chapters']
    arrayOfObjectsKeys.forEach((key) => {
      if (Array.isArray(payload[key]) && !payload[key].some((item: any) => typeof item !== 'object') && JSON.stringify((this as any)[key]) !== JSON.stringify(payload[key])) {
        ;(this as any)[key] = payload[key]
        this.changed(key as any, true)
        hasUpdates = true
      }
    })
    if (payload.ebookFile && JSON.stringify(this.ebookFile) !== JSON.stringify(payload.ebookFile)) {
      this.ebookFile = payload.ebookFile
      this.changed('ebookFile', true)
      hasUpdates = true
    }

    if (hasUpdates) {
      Logger.debug(`[Book] "${this.title}" changed keys:`, this.changed())
      await this.save()
    }

    return hasUpdates
  }

  async updateRelatedBooksRelationships(oldRelatedBooks: string[] = []) {
    const currentRelatedBooks = this.relatedBooks || []
    const previousRelatedBooks = oldRelatedBooks || []

    const addedRelations = currentRelatedBooks.filter((id) => !previousRelatedBooks.includes(id))
    const removedRelations = previousRelatedBooks.filter((id) => !currentRelatedBooks.includes(id))

    for (const relatedBookId of addedRelations) {
      try {
        const relatedBook = await this.sequelize!.models.book.findByPk(relatedBookId) as Book | null
        if (relatedBook) {
          const relatedBookRelations = relatedBook.relatedBooks || []
          if (!relatedBookRelations.includes(this.id)) {
            relatedBook.relatedBooks = [...relatedBookRelations, this.id]
            relatedBook.changed('relatedBooks', true)
            await relatedBook.save()
            Logger.debug(`[Book] Added bidirectional relationship: "${relatedBook.title}" (${relatedBook.id}) <-> "${this.title}" (${this.id})`)
          }
        }
      } catch (error) {
        Logger.error(`[Book] Failed to update related book ${relatedBookId}:`, error)
      }
    }

    for (const relatedBookId of removedRelations) {
      try {
        const relatedBook = await this.sequelize!.models.book.findByPk(relatedBookId) as Book | null
        if (relatedBook) {
          const relatedBookRelations = relatedBook.relatedBooks || []
          if (relatedBookRelations.includes(this.id)) {
            relatedBook.relatedBooks = relatedBookRelations.filter((id) => id !== this.id)
            relatedBook.changed('relatedBooks', true)
            await relatedBook.save()
            Logger.debug(`[Book] Removed bidirectional relationship: "${relatedBook.title}" (${relatedBook.id}) <-> "${this.title}" (${this.id})`)
          }
        }
      } catch (error) {
        Logger.error(`[Book] Failed to update related book ${relatedBookId}:`, error)
      }
    }
  }

  async incrementListeningTime(timeListeningSeconds: number) {
    if (!timeListeningSeconds || timeListeningSeconds <= 0) return

    const timeListeningMinutes = timeListeningSeconds / 60
    this.totalListeningTime = (this.totalListeningTime || 0) + timeListeningMinutes
    this.changed('totalListeningTime', true)
    await this.save()
    Logger.debug(`[Book] Incremented listening time for "${this.title}" by ${timeListeningMinutes.toFixed(2)} minutes. Total: ${this.totalListeningTime.toFixed(2)} minutes`)
  }

  async incrementViewedCount() {
    this.viewedCount = (this.viewedCount || 0) + 1
    this.changed('viewedCount', true)
    await this.save()
    Logger.info(`[Book] Incremented viewed count for "${this.title}". Total views: ${this.viewedCount}`)
  }

  async updateAuthorsFromRequest(authors: string[], libraryId: string) {
    if (!Array.isArray(authors)) return null

    if (!this.authors) {
      throw new Error(`[Book] Cannot update authors because authors are not loaded for book ${this.id}`)
    }

    const authorModel = this.sequelize!.models.author
    const bookAuthorModel = this.sequelize!.models.bookAuthor

    const authorsCleaned = authors.map((a) => a.toLowerCase()).filter((a) => a)
    const authorsRemoved = this.authors.filter((au: any) => !authorsCleaned.includes(au.name.toLowerCase()))
    const newAuthorNames = authors.filter((a) => !this.authors!.some((au: any) => au.name.toLowerCase() === a.toLowerCase()))

    for (const author of authorsRemoved) {
      await (bookAuthorModel as any).removeByIds(author.id, this.id)
      Logger.debug(`[Book] "${this.title}" Removed author "${author.name}"`)
      this.authors = this.authors!.filter((au: any) => au.id !== author.id)
    }
    const authorsAdded: any[] = []
    for (const authorName of newAuthorNames) {
      const author = await (authorModel as any).findOrCreateByNameAndLibrary(authorName, libraryId)
      await bookAuthorModel.create({ bookId: this.id, authorId: author.id } as any)
      Logger.debug(`[Book] "${this.title}" Added author "${author.name}"`)
      this.authors!.push(author)
      authorsAdded.push(author)
    }

    return {
      authorsRemoved,
      authorsAdded
    }
  }

  async updateSeriesFromRequest(seriesObjects: Array<{ name: string; sequence: string }>, libraryId: string) {
    if (!Array.isArray(seriesObjects) || seriesObjects.some((se) => !se.name || typeof se.name !== 'string')) return null

    if (!this.series) {
      throw new Error(`[Book] Cannot update series because series are not loaded for book ${this.id}`)
    }

    const seriesModel = this.sequelize!.models.series
    const bookSeriesModel = this.sequelize!.models.bookSeries

    const seriesNamesCleaned = seriesObjects.map((se) => se.name.toLowerCase())
    const seriesRemoved = this.series.filter((se: any) => !seriesNamesCleaned.includes(se.name.toLowerCase()))
    const seriesAdded: any[] = []
    let hasUpdates = false
    for (const seriesObj of seriesObjects) {
      const seriesObjSequence = typeof seriesObj.sequence === 'string' ? seriesObj.sequence : null

      const existingSeries = this.series.find((se: any) => se.name.toLowerCase() === seriesObj.name.toLowerCase()) as any
      if (existingSeries) {
        if (existingSeries.bookSeries.sequence !== seriesObjSequence) {
          existingSeries.bookSeries.sequence = seriesObjSequence
          await existingSeries.bookSeries.save()
          hasUpdates = true
          Logger.debug(`[Book] "${this.title}" Updated series "${existingSeries.name}" sequence ${seriesObjSequence}`)
        }
      } else {
        const series = await (seriesModel as any).findOrCreateByNameAndLibrary(seriesObj.name, libraryId)
        series.bookSeries = await bookSeriesModel.create({ bookId: this.id, seriesId: series.id, sequence: seriesObjSequence } as any)
        this.series!.push(series)
        seriesAdded.push(series)
        hasUpdates = true
        Logger.debug(`[Book] "${this.title}" Added series "${series.name}"`)
      }
    }

    for (const series of seriesRemoved) {
      await (bookSeriesModel as any).removeByIds((series as any).id, this.id)
      this.series = this.series!.filter((se: any) => se.id !== (series as any).id)
      Logger.debug(`[Book] "${this.title}" Removed series ${(series as any).id}`)
      hasUpdates = true
    }

    return {
      seriesRemoved,
      seriesAdded,
      hasUpdates
    }
  }

  oldMetadataToJSON() {
    const authors = this.authors!.map((au: any) => ({ id: au.id, name: au.name }))
    const series = this.series!.map((se: any) => ({ id: se.id, name: se.name, sequence: se.bookSeries.sequence }))
    return {
      title: this.title,
      subtitle: this.subtitle,
      authors,
      series,
      genres: [...(this.genres || [])],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged,
      rating: this.rating,
      url: this.getNormalizedUrls(),
      relatedBooks: this.relatedBooks || [],
      viewedCount: this.viewedCount || 0,
      totalListeningTime: this.totalListeningTime || 0
    }
  }

  oldMetadataToJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: getTitlePrefixAtEnd(this.title),
      subtitle: this.subtitle,
      authorName: this.authorName,
      authorNameLF: this.authorNameLF,
      seriesName: this.seriesName,
      genres: [...(this.genres || [])],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged,
      rating: this.rating,
      url: this.getNormalizedUrls(),
      relatedBooks: this.relatedBooks || [],
      viewedCount: this.viewedCount || 0,
      totalListeningTime: this.totalListeningTime || 0
    }
  }

  oldMetadataToJSONExpanded() {
    const oldMetadataJSON = this.oldMetadataToJSON()
    ;(oldMetadataJSON as any).titleIgnorePrefix = getTitlePrefixAtEnd(this.title)
    ;(oldMetadataJSON as any).authorName = this.authorName
    ;(oldMetadataJSON as any).authorNameLF = this.authorNameLF
    ;(oldMetadataJSON as any).seriesName = this.seriesName
    ;(oldMetadataJSON as any).descriptionPlain = this.description ? htmlSanitizer.stripAllTags(this.description) : null
    return oldMetadataJSON
  }

  toOldJSON(libraryItemId: string) {
    if (!libraryItemId) {
      throw new Error(`[Book] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.authors) {
      throw new Error(`[Book] Cannot convert to old JSON because authors are not loaded`)
    }
    if (!this.series) {
      throw new Error(`[Book] Cannot convert to old JSON because series are not loaded`)
    }

    return {
      id: this.id,
      libraryItemId: libraryItemId,
      metadata: this.oldMetadataToJSON(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      audioFiles: structuredClone(this.audioFiles),
      chapters: structuredClone(this.chapters),
      ebookFile: structuredClone(this.ebookFile)
    }
  }

  toOldJSONMinified() {
    if (!this.authors) {
      throw new Error(`[Book] Cannot convert to old JSON because authors are not loaded`)
    }
    if (!this.series) {
      throw new Error(`[Book] Cannot convert to old JSON because series are not loaded`)
    }

    return {
      id: this.id,
      metadata: this.oldMetadataToJSONMinified(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      numTracks: this.includedAudioFiles.length,
      numAudioFiles: this.audioFiles?.length || 0,
      numChapters: this.chapters?.length || 0,
      duration: this.duration,
      size: this.size,
      ebookFormat: this.ebookFile?.ebookFormat
    }
  }

  toOldJSONExpanded(libraryItemId: string) {
    if (!libraryItemId) {
      throw new Error(`[Book] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.authors) {
      throw new Error(`[Book] Cannot convert to old JSON because authors are not loaded`)
    }
    if (!this.series) {
      throw new Error(`[Book] Cannot convert to old JSON because series are not loaded`)
    }

    return {
      id: this.id,
      libraryItemId: libraryItemId,
      metadata: this.oldMetadataToJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      audioFiles: structuredClone(this.audioFiles),
      chapters: structuredClone(this.chapters),
      ebookFile: structuredClone(this.ebookFile),
      duration: this.duration,
      size: this.size,
      tracks: this.getTracklist(libraryItemId)
    }
  }
}

export = Book
