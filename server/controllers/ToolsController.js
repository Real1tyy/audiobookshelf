const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/LibraryItem')} libraryItem
 *
 * @typedef {RequestWithUser & RequestEntityObject} RequestWithLibraryItem
 */

class ToolsController {
  constructor() {}

  /**
   * POST: /api/tools/item/:id/encode-m4b
   * Start an audiobook merge to m4b task
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async encodeM4b(req, res) {
    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[MiscController] encodeM4b: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (!req.libraryItem.isBook) {
      Logger.error(`[MiscController] encodeM4b: Invalid library item ${req.params.id}: not a book`)
      return res.status(400).send('Invalid library item: not a book')
    }

    if (!req.libraryItem.hasAudioTracks) {
      Logger.error(`[MiscController] encodeM4b: Invalid audiobook ${req.params.id}: no audio tracks`)
      return res.status(400).send('Invalid audiobook: no audio tracks')
    }

    if (this.abMergeManager.getPendingTaskByLibraryItemId(req.libraryItem.id)) {
      Logger.error(`[MiscController] encodeM4b: Audiobook ${req.params.id} is already processing`)
      return res.status(400).send('Audiobook is already processing')
    }

    const options = req.query || {}
    Logger.info(`[ToolsController] encodeM4b: Starting audiobook merge for "${req.libraryItem.media.title}" with options: ${JSON.stringify(options)}`)
    this.abMergeManager.startAudiobookMerge(req.user.id, req.libraryItem, options)

    res.sendStatus(200)
  }

  /**
   * DELETE: /api/tools/item/:id/encode-m4b
   * Cancel a running m4b merge task
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async cancelM4bEncode(req, res) {
    const workerTask = this.abMergeManager.getPendingTaskByLibraryItemId(req.params.id)
    if (!workerTask) return res.sendStatus(404)

    this.abMergeManager.cancelEncode(workerTask.task)

    res.sendStatus(200)
  }

  /**
   * POST: /api/tools/item/:id/embed-metadata
   * Start audiobook embed task
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async embedAudioFileMetadata(req, res) {
    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioTracks || !req.libraryItem.isBook) {
      Logger.error(`[ToolsController] Invalid library item`)
      return res.sendStatus(400)
    }

    if (this.audioMetadataManager.getIsLibraryItemQueuedOrProcessing(req.libraryItem.id)) {
      Logger.error(`[ToolsController] Library item (${req.libraryItem.id}) is already in queue or processing`)
      return res.status(400).send('Library item is already in queue or processing')
    }

    const options = {
      forceEmbedChapters: req.query.forceEmbedChapters === '1',
      backup: req.query.backup === '1'
    }
    this.audioMetadataManager.updateMetadataForItem(req.user.id, req.libraryItem, options)
    res.sendStatus(200)
  }

  /**
   * POST: /api/tools/batch/embed-metadata
   * Start batch audiobook embed task
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchEmbedMetadata(req, res) {
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(400).send('Invalid request payload')
    }

    const libraryItems = []
    for (const libraryItemId of libraryItemIds) {
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        Logger.error(`[ToolsController] Batch embed metadata library item (${libraryItemId}) not found`)
        return res.sendStatus(404)
      }

      // Check user can access this library item
      if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
        Logger.error(`[ToolsController] Batch embed metadata library item (${libraryItemId}) not accessible to user "${req.user.username}"`)
        return res.sendStatus(403)
      }

      if (libraryItem.isMissing || !libraryItem.hasAudioTracks || !libraryItem.isBook) {
        Logger.error(`[ToolsController] Batch embed invalid library item (${libraryItemId})`)
        return res.sendStatus(400)
      }

      if (this.audioMetadataManager.getIsLibraryItemQueuedOrProcessing(libraryItemId)) {
        Logger.error(`[ToolsController] Batch embed library item (${libraryItemId}) is already in queue or processing`)
        return res.status(400).send('Library item is already in queue or processing')
      }

      libraryItems.push(libraryItem)
    }

    const options = {
      forceEmbedChapters: req.query.forceEmbedChapters === '1',
      backup: req.query.backup === '1'
    }
    this.audioMetadataManager.handleBatchEmbed(req.user.id, libraryItems, options)
    res.sendStatus(200)
  }

  /**
   * POST: /api/tools/item/:id/trim-audio
   * Start an audio trim task to remove sections from audio files
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async trimAudio(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[ToolsController] trimAudio: Non-root user "${req.user.username}" attempted to trim audio`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[ToolsController] trimAudio: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (!req.libraryItem.isBook) {
      Logger.error(`[ToolsController] trimAudio: Invalid library item ${req.params.id}: not a book`)
      return res.status(400).send('Invalid library item: not a book')
    }

    if (!req.libraryItem.hasAudioTracks) {
      Logger.error(`[ToolsController] trimAudio: Invalid audiobook ${req.params.id}: no audio tracks`)
      return res.status(400).send('Invalid audiobook: no audio tracks')
    }

    if (this.audioTrimManager.getIsLibraryItemQueuedOrProcessing(req.libraryItem.id)) {
      Logger.error(`[ToolsController] trimAudio: Audiobook ${req.params.id} is already processing`)
      return res.status(400).send('Audiobook is already processing')
    }

    const sections = req.body.sections
    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).send('Invalid request: sections must be a non-empty array')
    }

    for (const section of sections) {
      if (typeof section.start !== 'number' || typeof section.end !== 'number' || section.start < 0 || section.start >= section.end) {
        return res.status(400).send('Invalid section: each section must have start >= 0 and start < end')
      }
    }

    Logger.info(`[ToolsController] trimAudio: Starting trim for "${req.libraryItem.media.title}" with ${sections.length} section(s)`)
    this.audioTrimManager.trimAudioForItem(req.user.id, req.libraryItem, sections)

    res.sendStatus(200)
  }

  /**
   * POST: /api/tools/item/:id/extract-highlight
   * Extract a section of audio as a new highlight library item
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async extractHighlight(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[ToolsController] extractHighlight: Non-root user "${req.user.username}" attempted to extract highlight`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[ToolsController] extractHighlight: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (!req.libraryItem.isBook) {
      Logger.error(`[ToolsController] extractHighlight: Invalid library item ${req.params.id}: not a book`)
      return res.status(400).send('Invalid library item: not a book')
    }

    if (!req.libraryItem.hasAudioTracks) {
      Logger.error(`[ToolsController] extractHighlight: Invalid audiobook ${req.params.id}: no audio tracks`)
      return res.status(400).send('Invalid audiobook: no audio tracks')
    }

    if (this.audioExtractManager.getIsLibraryItemQueuedOrProcessing(req.libraryItem.id)) {
      Logger.error(`[ToolsController] extractHighlight: Audiobook ${req.params.id} is already processing`)
      return res.status(400).send('Audiobook is already processing')
    }

    const { startTime, endTime, title } = req.body
    if (typeof startTime !== 'number' || typeof endTime !== 'number' || !title || typeof title !== 'string') {
      return res.status(400).send('Invalid request: startTime (number), endTime (number), and title (string) are required')
    }

    if (startTime < 0 || startTime >= endTime) {
      return res.status(400).send('Invalid request: startTime must be >= 0 and less than endTime')
    }

    if (endTime > req.libraryItem.media.duration) {
      return res.status(400).send('Invalid request: endTime exceeds audio duration')
    }

    Logger.info(`[ToolsController] extractHighlight: Starting extract for "${req.libraryItem.media.title}" (${startTime}s - ${endTime}s) as "${title}"`)
    this.audioExtractManager.extractHighlightForItem(req.user.id, req.libraryItem, startTime, endTime, title.trim())

    res.sendStatus(200)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (req.params.id) {
      const item = await Database.libraryItemModel.getExpandedById(req.params.id)
      if (!item?.media) return res.sendStatus(404)

      // Check user can access this library item
      if (!req.user.checkCanAccessLibraryItem(item)) {
        return res.sendStatus(403)
      }

      req.libraryItem = item
    }

    next()
  }
}
module.exports = new ToolsController()
