const { Request, Response, NextFunction } = require('express')
const Path = require('path')
const fs = require('fs-extra')
const uaParserJs = require('ua-parser-js')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const zipHelpers = require('../utils/zipHelpers')
const { reqSupportsWebp } = require('../utils/index')
const { ScanResult } = require('../utils/constants')
const youtubeTranscript = require('../utils/youtubeTranscript')
const { sendXAccel, setAudioContentType, resDownload, resSendFile, handleDownloadError } = require('../utils/responseHelpers')
const LibraryItemScanner = require('../scanner/LibraryItemScanner')
const AudioFileScanner = require('../scanner/AudioFileScanner')
const Scanner = require('../scanner/Scanner')

const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')
const ShareManager = require('../managers/ShareManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/LibraryItem')} libraryItem
 *
 * @typedef {RequestWithUser & RequestEntityObject} LibraryItemControllerRequest
 *
 * @typedef RequestLibraryFileObject
 * @property {import('../objects/files/LibraryFile')} libraryFile
 *
 * @typedef {RequestWithUser & RequestEntityObject & RequestLibraryFileObject} LibraryItemControllerRequestWithFile
 */

class LibraryItemController {
  constructor() {}

  /**
   * POST: /api/items
   * Create a virtual library item (no audio files on disk).
   * Accepts: { libraryId, title, url, authorName, description, tags, transcript }
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to create item without permission`)
      return res.sendStatus(403)
    }

    const { libraryId, title, url, authorName, description, tags, transcript } = req.body
    if (!libraryId || !title) {
      return res.status(400).json({ error: 'libraryId and title are required' })
    }

    // Validate library exists
    const library = await Database.libraryModel.findByPk(libraryId)
    if (!library) {
      return res.status(404).json({ error: 'Library not found' })
    }

    const { getTitleIgnorePrefix } = require('../utils/index')
    const transcriptIndexer = require('../utils/transcriptIndexer')

    try {
      // Build URL value
      let urlValue = null
      if (url) {
        urlValue = Array.isArray(url) ? url : [url]
      }

      // Build book object
      const bookObject = {
        title,
        titleIgnorePrefix: getTitleIgnorePrefix(title),
        description: description || null,
        url: urlValue,
        tags: tags || [],
        audioFiles: [],
        duration: 0,
        chapters: [],
        genres: []
      }

      // Build library item object
      const libraryItemObj = {
        ino: null,
        path: null,
        relPath: title,
        mediaType: 'book',
        isFile: false,
        isMissing: false,
        isInvalid: false,
        mtime: 0,
        ctime: 0,
        birthtime: 0,
        size: 0,
        libraryFiles: [],
        extraData: { virtual: true },
        libraryId,
        libraryFolderId: null,
        title,
        titleIgnorePrefix: getTitleIgnorePrefix(title),
        authorNamesFirstLast: authorName || '',
        authorNamesLastFirst: authorName ? Database.authorModel.getLastFirst(authorName) : '',
        book: bookObject
      }

      // If author provided, find or create
      if (authorName) {
        const author = await Database.authorModel.findOrCreateByNameAndLibrary(authorName.trim(), libraryId)
        bookObject.bookAuthors = [
          {
            authorId: author.id
          }
        ]
        Database.addAuthorToFilterData(libraryId, author.name, author.id)
      }

      // Add tags to filter data
      if (tags?.length) {
        Database.addTagsToFilterData(libraryId, tags)
      }

      const libraryItem = await Database.libraryItemModel.create(libraryItemObj, {
        include: {
          model: Database.bookModel,
          include: [
            {
              model: Database.bookAuthorModel,
              include: {
                model: Database.authorModel
              }
            }
          ]
        }
      })

      // Load expanded item for response
      const expandedItem = await Database.libraryItemModel.findOneExpanded({ id: libraryItem.id })

      // Save and index transcript if provided, or auto-fetch from YouTube
      if (transcript && expandedItem) {
        await transcriptIndexer.saveAndIndex(expandedItem.id, libraryItem.book.id, title, transcript)
      } else if (!transcript && expandedItem && url && youtubeTranscript.isYouTubeUrl(Array.isArray(url) ? url[0] : url)) {
        // Auto-fetch transcript from YouTube (non-blocking — item still created if this fails)
        const ytUrl = Array.isArray(url) ? url[0] : url
        youtubeTranscript
          .fetchTranscript(ytUrl)
          .then(({ transcript: ytTranscript }) => {
            return transcriptIndexer.saveAndIndex(expandedItem.id, libraryItem.book.id, title, ytTranscript)
          })
          .then(() => {
            Logger.info(`[LibraryItemController] Auto-fetched YouTube transcript for "${title}"`)
          })
          .catch((err) => {
            Logger.warn(`[LibraryItemController] Failed to auto-fetch YouTube transcript for "${title}": ${err.message}`)
          })
      }

      if (expandedItem) {
        SocketAuthority.libraryItemEmitter('item_added', expandedItem)
        res.json(expandedItem.toOldJSONExpanded())
      } else {
        res.json(libraryItem.toJSON())
      }
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to create virtual item`, error)
      res.status(500).json({ error: 'Failed to create item' })
    }
  }

  /**
   * POST: /api/youtube/transcript
   * Fetch transcript from a YouTube video URL.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async fetchYouTubeTranscript(req, res) {
    const { url } = req.body
    if (!url) {
      return res.status(400).json({ error: 'url is required' })
    }

    if (!youtubeTranscript.isYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Not a valid YouTube URL' })
    }

    try {
      const result = await youtubeTranscript.fetchTranscript(url)
      res.json(result)
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to fetch YouTube transcript: ${error.message}`)
      res.status(422).json({ error: error.message || 'Failed to fetch transcript' })
    }
  }

  /**
   * GET: /api/items/:id
   * Optional query params:
   * ?include=progress,share,relatedbooks
   * ?expanded=1
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const includeEntities = (req.query.include || '').split(',')
    if (req.query.expanded == 1) {
      const item = req.libraryItem.toOldJSONExpanded()

      // Include users media progress
      if (includeEntities.includes('progress')) {
        item.userMediaProgress = req.user.getOldMediaProgress(item.id)
      }

      if (item.mediaType === 'book' && req.user.isAdminOrUp && includeEntities.includes('share')) {
        item.mediaItemShare = ShareManager.findByMediaItemId(item.media.id)
      }

      // Include related books data
      if (item.mediaType === 'book' && includeEntities.includes('relatedbooks') && item.media.metadata.relatedBooks?.length) {
        const relatedBooksData = []
        for (const bookId of item.media.metadata.relatedBooks) {
          try {
            const relatedLibraryItem = await Database.libraryItemModel.findOneExpanded({ mediaId: bookId })
            if (relatedLibraryItem && req.user.checkCanAccessLibraryItem(relatedLibraryItem)) {
              relatedBooksData.push({
                id: bookId,
                libraryItemId: relatedLibraryItem.id,
                title: relatedLibraryItem.media.title,
                subtitle: relatedLibraryItem.media.subtitle
              })
            }
          } catch (error) {
            Logger.error(`[LibraryItemController] Failed to load related book ${bookId}:`, error)
          }
        }
        item.relatedBooksData = relatedBooksData
      }

      return res.json(item)
    }
    res.json(req.libraryItem.toOldJSON())
  }

  /**
   * DELETE: /api/items/:id
   * Delete library item. Will delete from database and file system if hard delete is requested.
   * Optional query params:
   * ?hard=1
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    const hardDelete = req.query.hard == 1 // Delete from file system
    const libraryItemPath = req.libraryItem.path

    const mediaItemIds = [req.libraryItem.media.id]
    const authorIds = []
    const seriesIds = []
    if (req.libraryItem.media.authors?.length) {
      authorIds.push(...req.libraryItem.media.authors.map((au) => au.id))
    }
    if (req.libraryItem.media.series?.length) {
      seriesIds.push(...req.libraryItem.media.series.map((se) => se.id))
    }

    await this.handleDeleteLibraryItem(req.libraryItem.id, mediaItemIds)
    if (hardDelete && libraryItemPath) {
      Logger.info(`[LibraryItemController] Deleting library item from file system at "${libraryItemPath}"`)
      await fs.remove(libraryItemPath).catch((error) => {
        Logger.error(`[LibraryItemController] Failed to delete library item from file system at "${libraryItemPath}"`, error)
      })
    }

    if (authorIds.length) {
      await this.checkRemoveAuthorsWithNoBooks(authorIds)
    }
    if (seriesIds.length) {
      await this.checkRemoveEmptySeries(seriesIds)
    }

    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId)
    res.sendStatus(200)
  }

  /**
   * GET: /api/items/:id/download
   * Download library item. Zip file if multiple files.
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async download(req, res) {
    if (!req.libraryItem.path) {
      return res.status(400).json({ error: 'Virtual items cannot be downloaded' })
    }
    const libraryItemPath = req.libraryItem.path
    const itemTitle = req.libraryItem.media.title

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${itemTitle}" at "${libraryItemPath}"`)

    try {
      // If library item is a single file in root dir then no need to zip
      if (req.libraryItem.isFile) {
        setAudioContentType(res, libraryItemPath)
        await resDownload(res, libraryItemPath, req.libraryItem.relPath)
      } else {
        const filename = `${itemTitle}.zip`
        await zipHelpers.zipDirectoryPipe(libraryItemPath, filename, res)
      }
      Logger.info(`[LibraryItemController] Downloaded item "${itemTitle}" at "${libraryItemPath}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Download failed for item "${itemTitle}" at "${libraryItemPath}"`, error)
      handleDownloadError(error, res)
    }
  }

  /**
   * PATCH: /items/:id/media
   * Update media for a library item. Will create new authors & series when necessary
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async updateMedia(req, res) {
    const mediaPayload = req.body

    if (mediaPayload.url) {
      await LibraryItemController.prototype.uploadCover.bind(this)(req, res, false)
      if (res.writableEnded || res.headersSent) return
    }

    // Store old related books for bidirectional relationship updates
    const oldRelatedBooks = req.libraryItem.isBook ? [...(req.libraryItem.media.relatedBooks || [])] : []

    let hasUpdates = (await req.libraryItem.media.updateFromRequest(mediaPayload)) || mediaPayload.url

    // Update bidirectional related books relationships
    if (req.libraryItem.isBook && mediaPayload.metadata?.relatedBooks !== undefined) {
      await req.libraryItem.media.updateRelatedBooksRelationships(oldRelatedBooks)
    }

    if (req.libraryItem.isBook && Array.isArray(mediaPayload.metadata?.series)) {
      const seriesUpdateData = await req.libraryItem.media.updateSeriesFromRequest(mediaPayload.metadata.series, req.libraryItem.libraryId)
      if (seriesUpdateData?.seriesRemoved.length) {
        // Check remove empty series
        Logger.debug(`[LibraryItemController] Series were removed from book. Check if series are now empty.`)
        await this.checkRemoveEmptySeries(seriesUpdateData.seriesRemoved.map((se) => se.id))
      }
      if (seriesUpdateData?.seriesAdded.length) {
        // Add series to filter data
        seriesUpdateData.seriesAdded.forEach((se) => {
          Database.addSeriesToFilterData(req.libraryItem.libraryId, se.name, se.id)
        })
      }
      if (seriesUpdateData?.hasUpdates) {
        hasUpdates = true
      }
    }

    if (req.libraryItem.isBook && Array.isArray(mediaPayload.metadata?.authors)) {
      const authorNames = mediaPayload.metadata.authors.map((au) => (typeof au.name === 'string' ? au.name.trim() : null)).filter((au) => au)
      const authorUpdateData = await req.libraryItem.media.updateAuthorsFromRequest(authorNames, req.libraryItem.libraryId)
      if (authorUpdateData?.authorsRemoved.length) {
        // Check remove empty authors
        Logger.debug(`[LibraryItemController] Authors were removed from book. Check if authors are now empty.`)
        await this.checkRemoveAuthorsWithNoBooks(authorUpdateData.authorsRemoved.map((au) => au.id))
        hasUpdates = true
      }
      if (authorUpdateData?.authorsAdded.length) {
        // Add authors to filter data
        authorUpdateData.authorsAdded.forEach((au) => {
          Database.addAuthorToFilterData(req.libraryItem.libraryId, au.name, au.id)
        })
        hasUpdates = true
      }
    }

    // Handle transcript update for books
    if (req.libraryItem.isBook && typeof mediaPayload.transcript === 'string') {
      const transcriptIndexer = require('../utils/transcriptIndexer')
      const newTranscript = mediaPayload.transcript.trim() || null
      if (req.libraryItem.media.transcript !== newTranscript) {
        req.libraryItem.media.transcript = newTranscript
        await req.libraryItem.media.save()
        if (newTranscript) {
          await transcriptIndexer.saveAndIndex(req.libraryItem.id, req.libraryItem.media.id, req.libraryItem.media.title, newTranscript)
        } else {
          await transcriptIndexer.removeTranscript(req.libraryItem.id)
        }
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      // Always keep metadata file in sync for edits (series/authors changes may not update Book directly)
      await req.libraryItem.saveMetadataFile()

      Logger.debug(`[LibraryItemController] Updated library item media ${req.libraryItem.media.title}`)
      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }
    res.json({
      updated: hasUpdates,
      libraryItem: req.libraryItem.toOldJSON()
    })
  }

  /**
   * POST: /api/items/:id/cover
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   * @param {boolean} [updateAndReturnJson=true] - Allows the function to be used for both direct API calls and internally
   */
  async uploadCover(req, res, updateAndReturnJson = true) {
    let result = null
    if (req.body?.url) {
      Logger.debug(`[LibraryItemController] Requesting download cover from url "${req.body.url}"`)
      result = await CoverManager.downloadCoverFromUrlNew(req.body.url, req.libraryItem.id, req.libraryItem.isFile ? null : req.libraryItem.path)
    } else if (req.files?.cover) {
      Logger.debug(`[LibraryItemController] Handling uploaded cover`)
      result = await CoverManager.uploadCover(req.libraryItem, req.files.cover)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result?.error) {
      return res.status(400).send(result.error)
    } else if (!result?.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    req.libraryItem.media.coverPath = result.cover
    req.libraryItem.media.changed('coverPath', true)
    await req.libraryItem.media.save()

    if (updateAndReturnJson) {
      // client uses updatedAt timestamp in URL to force refresh cover
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
      res.json({
        success: true,
        cover: result.cover
      })
    }
  }

  /**
   * PATCH: /api/items/:id/cover
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async updateCover(req, res) {
    if (!req.body.cover) {
      return res.status(400).send('Invalid request no cover path')
    }

    const validationResult = await CoverManager.validateCoverPath(req.body.cover, req.libraryItem)
    if (validationResult.error) {
      return res.status(500).send(validationResult.error)
    }
    if (validationResult.updated) {
      req.libraryItem.media.coverPath = validationResult.cover
      req.libraryItem.media.changed('coverPath', true)
      await req.libraryItem.media.save()

      // client uses updatedAt timestamp in URL to force refresh cover
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }
    res.json({
      success: true,
      cover: validationResult.cover
    })
  }

  /**
   * DELETE: /api/items/:id/cover
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async removeCover(req, res) {
    if (req.libraryItem.media.coverPath) {
      req.libraryItem.media.coverPath = null
      req.libraryItem.media.changed('coverPath', true)
      await req.libraryItem.media.save()

      // client uses updatedAt timestamp in URL to force refresh cover
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      await CacheManager.purgeCoverCache(req.libraryItem.id)

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/items/:id/cover
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async getCover(req, res) {
    const {
      query: { width, height, format, raw }
    } = req

    if (req.query.ts) res.set('Cache-Control', 'private, max-age=86400')

    const libraryItemId = req.params.id
    if (!libraryItemId) {
      return res.sendStatus(400)
    }

    if (raw) {
      const coverPath = await Database.libraryItemModel.getCoverPath(libraryItemId)
      if (!coverPath || !(await fs.pathExists(coverPath))) {
        return res.sendStatus(404)
      }
      if (sendXAccel(res, coverPath)) return
      return res.sendFile(coverPath)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return CacheManager.handleCoverCache(res, libraryItemId, options)
  }

  /**
   * POST: /api/items/:id/play
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  startPlaybackSession(req, res) {
    if (!req.libraryItem.hasAudioTracks) {
      Logger.error(`[LibraryItemController] startPlaybackSession cannot playback ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    this.playbackSessionManager.startSessionRequest(req, res)
  }

  /**
   * PATCH: /api/items/:id/tracks
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async updateTracks(req, res) {
    const orderedFileData = req.body?.orderedFileData

    if (!req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] updateTracks invalid media type ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }
    if (!Array.isArray(orderedFileData) || !orderedFileData.length) {
      Logger.error(`[LibraryItemController] updateTracks invalid orderedFileData ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }
    // Ensure that each orderedFileData has a valid ino and is in the book audioFiles
    if (orderedFileData.some((fileData) => !fileData?.ino || !req.libraryItem.media.audioFiles.some((af) => af.ino === fileData.ino))) {
      Logger.error(`[LibraryItemController] updateTracks invalid orderedFileData ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }

    let index = 1
    const updatedAudioFiles = orderedFileData.map((fileData) => {
      const audioFile = req.libraryItem.media.audioFiles.find((af) => af.ino === fileData.ino)
      audioFile.manuallyVerified = true
      audioFile.exclude = !!fileData.exclude
      if (audioFile.exclude) {
        audioFile.index = -1
      } else {
        audioFile.index = index++
      }
      return audioFile
    })
    updatedAudioFiles.sort((a, b) => a.index - b.index)

    req.libraryItem.media.audioFiles = updatedAudioFiles
    req.libraryItem.media.changed('audioFiles', true)
    await req.libraryItem.media.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.json(req.libraryItem.toOldJSON())
  }

  /**
   * POST /api/items/:id/match
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async match(req, res) {
    const reqBody = req.body || {}

    const options = {}
    const matchOptions = ['provider', 'title', 'author', 'isbn', 'asin']
    for (const key of matchOptions) {
      if (reqBody[key] && typeof reqBody[key] === 'string') {
        options[key] = reqBody[key]
      }
    }
    if (reqBody.overrideCover !== undefined) {
      options.overrideCover = !!reqBody.overrideCover
    }
    if (reqBody.overrideDetails !== undefined) {
      options.overrideDetails = !!reqBody.overrideDetails
    }

    const matchResult = await Scanner.quickMatchLibraryItem(this, req.libraryItem, options)
    res.json(matchResult)
  }

  /**
   * POST: /api/items/batch/delete
   * Batch delete library items. Will delete from database and file system if hard delete is requested.
   * Optional query params:
   * ?hard=1
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchDelete(req, res) {
    const hardDelete = req.query.hard == 1 // Delete files from filesystem

    const { libraryItemIds } = req.body
    if (!libraryItemIds?.length || !Array.isArray(libraryItemIds)) {
      return res.status(400).send('Invalid request body')
    }

    const itemsToDelete = await Database.libraryItemModel.findAllExpandedWhere({
      id: libraryItemIds
    })

    if (!itemsToDelete.length) {
      return res.sendStatus(404)
    }

    const libraryId = itemsToDelete[0].libraryId
    for (const libraryItem of itemsToDelete) {
      const libraryItemPath = libraryItem.path
      Logger.info(`[LibraryItemController] (${hardDelete ? 'Hard' : 'Soft'}) deleting Library Item "${libraryItem.media.title}" with id "${libraryItem.id}"`)
      const mediaItemIds = [libraryItem.media.id]
      const seriesIds = []
      const authorIds = []
      if (libraryItem.media.series?.length) {
        seriesIds.push(...libraryItem.media.series.map((se) => se.id))
      }
      if (libraryItem.media.authors?.length) {
        authorIds.push(...libraryItem.media.authors.map((au) => au.id))
      }
      await this.handleDeleteLibraryItem(libraryItem.id, mediaItemIds)
      if (hardDelete) {
        Logger.info(`[LibraryItemController] Deleting library item from file system at "${libraryItemPath}"`)
        await fs.remove(libraryItemPath).catch((error) => {
          Logger.error(`[LibraryItemController] Failed to delete library item from file system at "${libraryItemPath}"`, error)
        })
      }
      if (seriesIds.length) {
        await this.checkRemoveEmptySeries(seriesIds)
      }
      if (authorIds.length) {
        await this.checkRemoveAuthorsWithNoBooks(authorIds)
      }
    }

    await Database.resetLibraryIssuesFilterData(libraryId)
    res.sendStatus(200)
  }

  /**
   * POST: /api/items/batch/update
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchUpdate(req, res) {
    const updatePayloads = req.body
    if (!Array.isArray(updatePayloads) || !updatePayloads.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Invalid payload`)
      return res.sendStatus(400)
    }

    // Ensure that each update payload has a unique library item id
    const libraryItemIds = [...new Set(updatePayloads.map((up) => up?.id).filter((id) => id))]
    if (!libraryItemIds.length || libraryItemIds.length !== updatePayloads.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Each update payload must have a unique library item id`)
      return res.sendStatus(400)
    }

    // Get all library items to update
    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({
      id: libraryItemIds
    })
    if (updatePayloads.length !== libraryItems.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Not all library items found`)
      return res.sendStatus(404)
    }

    let itemsUpdated = 0

    const seriesIdsRemoved = []
    const authorIdsRemoved = []

    for (const updatePayload of updatePayloads) {
      const mediaPayload = updatePayload.mediaPayload
      const libraryItem = libraryItems.find((li) => li.id === updatePayload.id)

      // Store old related books for bidirectional relationship updates
      const oldRelatedBooks = libraryItem.isBook ? [...(libraryItem.media.relatedBooks || [])] : []

      let hasUpdates = await libraryItem.media.updateFromRequest(mediaPayload)

      // Update bidirectional related books relationships
      if (libraryItem.isBook && mediaPayload.metadata?.relatedBooks !== undefined) {
        await libraryItem.media.updateRelatedBooksRelationships(oldRelatedBooks)
      }

      if (libraryItem.isBook && Array.isArray(mediaPayload.metadata?.series)) {
        const seriesUpdateData = await libraryItem.media.updateSeriesFromRequest(mediaPayload.metadata.series, libraryItem.libraryId)
        if (seriesUpdateData?.seriesRemoved.length) {
          seriesIdsRemoved.push(...seriesUpdateData.seriesRemoved.map((se) => se.id))
        }
        if (seriesUpdateData?.seriesAdded.length) {
          seriesUpdateData.seriesAdded.forEach((se) => {
            Database.addSeriesToFilterData(libraryItem.libraryId, se.name, se.id)
          })
        }
        if (seriesUpdateData?.hasUpdates) {
          hasUpdates = true
        }
      }

      if (libraryItem.isBook && Array.isArray(mediaPayload.metadata?.authors)) {
        const authorNames = mediaPayload.metadata.authors.map((au) => (typeof au.name === 'string' ? au.name.trim() : null)).filter((au) => au)
        const authorUpdateData = await libraryItem.media.updateAuthorsFromRequest(authorNames, libraryItem.libraryId)
        if (authorUpdateData?.authorsRemoved.length) {
          authorIdsRemoved.push(...authorUpdateData.authorsRemoved.map((au) => au.id))
          hasUpdates = true
        }
        if (authorUpdateData?.authorsAdded.length) {
          authorUpdateData.authorsAdded.forEach((au) => {
            Database.addAuthorToFilterData(libraryItem.libraryId, au.name, au.id)
          })
          hasUpdates = true
        }
      }

      if (hasUpdates) {
        libraryItem.changed('updatedAt', true)
        await libraryItem.save()

        // Always keep metadata file in sync for edits (series/authors changes may not update Book directly)
        await libraryItem.saveMetadataFile()

        Logger.debug(`[LibraryItemController] Updated library item media "${libraryItem.media.title}"`)
        SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
        itemsUpdated++
      }
    }

    if (seriesIdsRemoved.length) {
      await this.checkRemoveEmptySeries(seriesIdsRemoved)
    }
    if (authorIdsRemoved.length) {
      await this.checkRemoveAuthorsWithNoBooks(authorIdsRemoved)
    }

    res.json({
      success: true,
      updates: itemsUpdated
    })
  }

  /**
   * POST: /api/items/batch/get
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchGet(req, res) {
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(403).send('Invalid payload')
    }
    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({
      id: libraryItemIds
    })
    res.json({
      libraryItems: libraryItems.map((li) => li.toOldJSONExpanded())
    })
  }

  /**
   * POST: /api/items/batch/quickmatch
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchQuickMatch(req, res) {

    let itemsUpdated = 0
    let itemsUnmatched = 0

    if (!req.body.libraryItemIds?.length) {
      return res.sendStatus(400)
    }

    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({
      id: req.body.libraryItemIds
    })
    if (!libraryItems?.length) {
      return res.sendStatus(400)
    }

    res.sendStatus(200)

    const reqBodyOptions = req.body.options || {}
    const options = {}
    if (reqBodyOptions.provider && typeof reqBodyOptions.provider === 'string') {
      options.provider = reqBodyOptions.provider
    }
    if (reqBodyOptions.overrideCover !== undefined) {
      options.overrideCover = !!reqBodyOptions.overrideCover
    }
    if (reqBodyOptions.overrideDetails !== undefined) {
      options.overrideDetails = !!reqBodyOptions.overrideDetails
    }

    for (const libraryItem of libraryItems) {
      const matchResult = await Scanner.quickMatchLibraryItem(this, libraryItem, options)
      if (matchResult.updated) {
        itemsUpdated++
      } else if (matchResult.warning) {
        itemsUnmatched++
      }
    }

    const result = {
      success: itemsUpdated > 0,
      updates: itemsUpdated,
      unmatched: itemsUnmatched
    }
    SocketAuthority.clientEmitter(req.user.id, 'batch_quickmatch_complete', result)
  }

  /**
   * POST: /api/items/batch/scan
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchScan(req, res) {

    if (!req.body.libraryItemIds?.length) {
      return res.sendStatus(400)
    }

    const libraryItems = await Database.libraryItemModel.findAll({
      where: {
        id: req.body.libraryItemIds
      },
      attributes: ['id', 'libraryId', 'isFile']
    })
    if (!libraryItems?.length) {
      return res.sendStatus(400)
    }

    res.sendStatus(200)

    const libraryId = libraryItems[0].libraryId
    for (const libraryItem of libraryItems) {
      if (libraryItem.isFile) {
        Logger.warn(`[LibraryItemController] Re-scanning file library items not yet supported`)
      } else {
        await LibraryItemScanner.scanLibraryItem(libraryItem.id)
      }
    }

    await Database.resetLibraryIssuesFilterData(libraryId)
  }

  /**
   * POST: /api/items/:id/scan
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async scan(req, res) {

    if (!req.libraryItem.path) {
      return res.json({ result: 'NOTHING' })
    }

    if (req.libraryItem.isFile) {
      Logger.error(`[LibraryItemController] Re-scanning file library items not yet supported`)
      return res.sendStatus(500)
    }

    const result = await LibraryItemScanner.scanLibraryItem(req.libraryItem.id)
    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId)
    res.json({
      result: Object.keys(ScanResult).find((key) => ScanResult[key] == result)
    })
  }

  /**
   * GET: /api/items/:id/metadata-object
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  getMetadataObject(req, res) {

    if (req.libraryItem.isMissing || !req.libraryItem.isBook || !req.libraryItem.media.includedAudioFiles.length) {
      Logger.error(`[LibraryItemController] getMetadataObject: Invalid library item "${req.libraryItem.media.title}"`)
      return res.sendStatus(400)
    }

    res.json(this.audioMetadataManager.getMetadataObjectForApi(req.libraryItem))
  }

  /**
   * POST: /api/items/:id/chapters
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async updateMediaChapters(req, res) {
    if (!req.user.canUpdate) {
      Logger.error(`[LibraryItemController] User "${req.user.username}" attempted to update chapters with invalid permissions`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.isBook || !req.libraryItem.media.hasAudioTracks) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    if (!Array.isArray(req.body.chapters) || req.body.chapters.some((c) => !c.title || typeof c.title !== 'string' || c.start === undefined || typeof c.start !== 'number' || c.end === undefined || typeof c.end !== 'number')) {
      Logger.error(`[LibraryItemController] Invalid payload`)
      return res.sendStatus(400)
    }

    const chapters = req.body.chapters || []

    let hasUpdates = false
    if (chapters.length !== req.libraryItem.media.chapters.length) {
      req.libraryItem.media.chapters = chapters.map((c, index) => {
        return {
          id: index,
          title: c.title,
          start: c.start,
          end: c.end
        }
      })
      hasUpdates = true
    } else {
      for (const [index, chapter] of chapters.entries()) {
        const currentChapter = req.libraryItem.media.chapters[index]
        if (currentChapter.title !== chapter.title || currentChapter.start !== chapter.start || currentChapter.end !== chapter.end) {
          currentChapter.title = chapter.title
          currentChapter.start = chapter.start
          currentChapter.end = chapter.end
          hasUpdates = true
        }
      }
    }

    if (hasUpdates) {
      req.libraryItem.media.changed('chapters', true)
      await req.libraryItem.media.save()

      await req.libraryItem.saveMetadataFile()

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }

    res.json({
      success: true,
      updated: hasUpdates
    })
  }

  /**
   * GET: /api/items/:id/ffprobe/:fileid
   * FFProbe JSON result from audio file
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async getFFprobeData(req, res) {

    const audioFile = req.libraryItem.getAudioFileWithIno(req.params.fileid)
    if (!audioFile) {
      Logger.error(`[LibraryItemController] Audio file not found with inode value ${req.params.fileid}`)
      return res.sendStatus(404)
    }

    const ffprobeData = await AudioFileScanner.probeAudioFile(audioFile.metadata.path)
    res.json(ffprobeData)
  }

  /**
   * GET api/items/:id/file/:fileid
   *
   * @param {LibraryItemControllerRequestWithFile} req
   * @param {Response} res
   */
  async getLibraryFile(req, res) {
    const libraryFile = req.libraryFile

    if (sendXAccel(res, libraryFile.metadata.path)) return

    setAudioContentType(res, libraryFile.metadata.path)
    // Explicitly advertise Range request support for resumable downloads
    res.setHeader('Accept-Ranges', 'bytes')
    res.sendFile(libraryFile.metadata.path)
  }

  /**
   * DELETE api/items/:id/file/:fileid
   *
   * @param {LibraryItemControllerRequestWithFile} req
   * @param {Response} res
   */
  async deleteLibraryFile(req, res) {
    const libraryFile = req.libraryFile

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested file delete at "${libraryFile.metadata.path}"`)

    await fs.remove(libraryFile.metadata.path).catch((error) => {
      Logger.error(`[LibraryItemController] Failed to delete library file at "${libraryFile.metadata.path}"`, error)
    })

    req.libraryItem.libraryFiles = req.libraryItem.libraryFiles.filter((lf) => lf.ino !== req.params.fileid)
    req.libraryItem.changed('libraryFiles', true)

    if (req.libraryItem.isBook) {
      if (req.libraryItem.media.audioFiles.some((af) => af.ino === req.params.fileid)) {
        req.libraryItem.media.audioFiles = req.libraryItem.media.audioFiles.filter((af) => af.ino !== req.params.fileid)
        req.libraryItem.media.changed('audioFiles', true)
      } else if (req.libraryItem.media.ebookFile?.ino === req.params.fileid) {
        req.libraryItem.media.ebookFile = null
        req.libraryItem.media.changed('ebookFile', true)
      }
      if (!req.libraryItem.media.hasMediaFiles) {
        req.libraryItem.isMissing = true
      }
    }

    if (req.libraryItem.media.changed()) {
      await req.libraryItem.media.save()
    }

    await req.libraryItem.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.sendStatus(200)
  }

  /**
   * GET api/items/:id/file/:fileid/download
   * Same as GET api/items/:id/file/:fileid but allows logging and restricting downloads
   *
   * @param {LibraryItemControllerRequestWithFile} req
   * @param {Response} res
   */
  async downloadLibraryFile(req, res) {
    const libraryFile = req.libraryFile
    const ua = uaParserJs(req.headers['user-agent'])

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${req.libraryItem.media.title}" file at "${libraryFile.metadata.path}"`)

    if (sendXAccel(res, libraryFile.metadata.path)) return

    setAudioContentType(res, libraryFile.metadata.path, ua)

    try {
      await resDownload(res, libraryFile.metadata.path, libraryFile.metadata.filename)
      Logger.info(`[LibraryItemController] Downloaded file "${libraryFile.metadata.path}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to download file "${libraryFile.metadata.path}"`, error)
      handleDownloadError(error, res)
    }
  }

  /**
   * GET api/items/:id/ebook/:fileid?
   * fileid is the inode value stored in LibraryFile.ino or EBookFile.ino
   * fileid is only required when reading a supplementary ebook
   * when no fileid is passed in the primary ebook will be returned
   *
   * @param {LibraryItemControllerRequest} req
   * @param {Response} res
   */
  async getEBookFile(req, res) {
    let ebookFile = null
    if (req.params.fileid) {
      ebookFile = req.libraryItem.getLibraryFileWithIno(req.params.fileid)
      if (!ebookFile?.isEBookFile) {
        Logger.error(`[LibraryItemController] Invalid ebook file id "${req.params.fileid}"`)
        return res.status(400).send('Invalid ebook file id')
      }
    } else {
      ebookFile = req.libraryItem.media.ebookFile
    }

    if (!ebookFile) {
      Logger.error(`[LibraryItemController] No ebookFile for library item "${req.libraryItem.media.title}"`)
      return res.sendStatus(404)
    }
    const ebookFilePath = ebookFile.metadata.path

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${req.libraryItem.media.title}" ebook at "${ebookFilePath}"`)

    if (sendXAccel(res, ebookFilePath)) return

    try {
      await resSendFile(res, ebookFilePath)
      Logger.info(`[LibraryItemController] Downloaded ebook file "${ebookFilePath}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to download ebook file "${ebookFilePath}"`, error)
      handleDownloadError(error, res)
    }
  }

  /**
   * PATCH api/items/:id/ebook/:fileid/status
   * toggle the status of an ebook file.
   * if an ebook file is the primary ebook, then it will be changed to supplementary
   * if an ebook file is supplementary, then it will be changed to primary
   *
   * @param {LibraryItemControllerRequestWithFile} req
   * @param {Response} res
   */
  async updateEbookFileStatus(req, res) {
    if (!req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid media type for ebook file status update`)
      return res.sendStatus(400)
    }
    if (!req.libraryFile?.isEBookFile) {
      Logger.error(`[LibraryItemController] Invalid ebook file id "${req.params.fileid}"`)
      return res.status(400).send('Invalid ebook file id')
    }

    const ebookLibraryFile = req.libraryFile
    let primaryEbookFile = null

    const ebookLibraryFileInos = req.libraryItem
      .getLibraryFiles()
      .filter((lf) => lf.isEBookFile)
      .map((lf) => lf.ino)

    if (ebookLibraryFile.isSupplementary) {
      Logger.info(`[LibraryItemController] Updating ebook file "${ebookLibraryFile.metadata.filename}" to primary`)

      primaryEbookFile = ebookLibraryFile.toJSON()
      delete primaryEbookFile.isSupplementary
      delete primaryEbookFile.fileType
      primaryEbookFile.ebookFormat = ebookLibraryFile.metadata.format
    } else {
      Logger.info(`[LibraryItemController] Updating ebook file "${ebookLibraryFile.metadata.filename}" to supplementary`)
    }

    req.libraryItem.media.ebookFile = primaryEbookFile
    req.libraryItem.media.changed('ebookFile', true)
    await req.libraryItem.media.save()

    req.libraryItem.libraryFiles = req.libraryItem.libraryFiles.map((lf) => {
      if (ebookLibraryFileInos.includes(lf.ino)) {
        lf.isSupplementary = lf.ino !== primaryEbookFile?.ino
      }
      return lf
    })
    req.libraryItem.changed('libraryFiles', true)

    req.libraryItem.isMissing = !req.libraryItem.media.hasMediaFiles

    await req.libraryItem.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.sendStatus(200)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    req.libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!req.libraryItem?.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(req.libraryItem)) {
      return res.sendStatus(403)
    }

    // For library file routes, get the library file
    if (req.params.fileid) {
      req.libraryFile = req.libraryItem.getLibraryFileWithIno(req.params.fileid)
      if (!req.libraryFile) {
        Logger.error(`[LibraryItemController] Library file "${req.params.fileid}" does not exist for library item`)
        return res.sendStatus(404)
      }
    }

    if (req.path.includes('/play')) {
      // allow POST requests using /play
    } else if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new LibraryItemController()
