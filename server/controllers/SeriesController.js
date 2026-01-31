const { Request, Response, NextFunction } = require('express')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const RssFeedManager = require('../managers/RssFeedManager')
const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')

const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')
const { reqSupportsWebp } = require('../utils/index')
const { downloadImageFile, encodeUriPath } = require('../utils/fileUtils')

/**
 * Save series image from URL
 * @param {string} seriesId
 * @param {string} url
 * @returns {Promise<{path?: string, error?: string}>}
 */
async function saveSeriesImage(seriesId, url) {
  const seriesDir = Path.join(global.MetadataPath, 'series')

  if (!(await fs.pathExists(seriesDir))) {
    await fs.ensureDir(seriesDir)
  }

  const imageExtension = url.toLowerCase().split('.').pop()
  const ext = imageExtension === 'png' ? 'png' : 'jpg'
  const filename = seriesId + '.' + ext
  const outputPath = Path.posix.join(seriesDir, filename)

  return downloadImageFile(url, outputPath)
    .then(() => {
      return {
        path: outputPath
      }
    })
    .catch((err) => {
      let errorMsg = err.message || 'Unknown error'
      Logger.error(`[SeriesController] Download image file failed for "${url}"`, errorMsg)
      return {
        error: errorMsg
      }
    })
}

/**
 * Save series image from base64 data
 * @param {string} seriesId
 * @param {string} base64Data
 * @returns {Promise<{path?: string, error?: string}>}
 */
async function saveSeriesImageFromBase64(seriesId, base64Data) {
  const seriesDir = Path.join(global.MetadataPath, 'series')

  if (!(await fs.pathExists(seriesDir))) {
    await fs.ensureDir(seriesDir)
  }

  // Extract format from base64 header
  let ext = 'jpg'
  if (base64Data.startsWith('data:image/png')) {
    ext = 'png'
  } else if (base64Data.startsWith('data:image/webp')) {
    ext = 'webp'
  }

  // Remove data URL prefix if present
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Image, 'base64')

  const filename = seriesId + '.' + ext
  const outputPath = Path.join(seriesDir, filename)

  try {
    await fs.writeFile(outputPath, buffer)
    return { path: outputPath }
  } catch (err) {
    Logger.error(`[SeriesController] Failed to save base64 image for series "${seriesId}"`, err)
    return { error: err.message || 'Failed to save image' }
  }
}

/**
 * Save series image from uploaded file
 * @param {string} seriesId
 * @param {Object} coverFile - File object from express-fileupload
 * @returns {Promise<{path?: string, error?: string}>}
 */
async function saveSeriesImageFromFile(seriesId, coverFile) {
  const globals = require('../utils/globals')
  const extname = Path.extname(coverFile.name.toLowerCase())
  if (!extname || !globals.SupportedImageTypes.includes(extname.slice(1))) {
    return {
      error: `Invalid image type ${extname} (Supported: ${globals.SupportedImageTypes.join(',')})`
    }
  }

  const seriesDir = Path.join(global.MetadataPath, 'series')

  if (!(await fs.pathExists(seriesDir))) {
    await fs.ensureDir(seriesDir)
  }

  const filename = seriesId + extname
  const outputPath = Path.join(seriesDir, filename)

  // Move cover from temp upload dir to destination
  const success = await coverFile
    .mv(outputPath)
    .then(() => true)
    .catch((error) => {
      Logger.error('[SeriesController] Failed to move cover file', outputPath, error)
      return false
    })

  if (!success) {
    return {
      error: 'Failed to move cover into destination'
    }
  }

  return { path: outputPath }
}

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/Series')} series
 *
 * @typedef {RequestWithUser & RequestEntityObject} SeriesControllerRequest
 */

class SeriesController {
  constructor() {}

  /**
   * @deprecated
   * /api/series/:id
   *
   * TODO: Update mobile app to use /api/libraries/:id/series/:seriesId API route instead
   * Series are not library specific so we need to know what the library id is
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => !!v)

    const seriesJson = req.series.toOldJSON()

    // Add progress map with isFinished flag
    if (include.includes('progress')) {
      const libraryItemsInSeries = req.libraryItemsInSeries
      const libraryItemsFinished = libraryItemsInSeries.filter((li) => {
        return req.user.getMediaProgress(li.media.id)?.isFinished
      })
      seriesJson.progress = {
        libraryItemIds: libraryItemsInSeries.map((li) => li.id),
        libraryItemIdsFinished: libraryItemsFinished.map((li) => li.id),
        isFinished: libraryItemsFinished.length === libraryItemsInSeries.length
      }
    }

    if (include.includes('rssfeed')) {
      const feedObj = await RssFeedManager.findFeedForEntityId(seriesJson.id)
      seriesJson.rssFeed = feedObj?.toOldJSONMinified() || null
    }

    res.json(seriesJson)
  }

  /**
   * PATCH: /api/series/:id
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    const keysToUpdate = ['name', 'description']
    const payload = {}
    for (const key of keysToUpdate) {
      if (req.body[key] !== undefined && (typeof req.body[key] === 'string' || req.body[key] === null)) {
        payload[key] = req.body[key]
      }
    }
    if (!Object.keys(payload).length) {
      return res.status(400).send('No valid fields to update')
    }
    req.series.set(payload)
    if (req.series.changed()) {
      await req.series.save()
      SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    }
    res.json(req.series.toOldJSON())
  }

  /**
   * POST: /api/series/:id/cover
   * Upload series cover image from URL, base64, or file upload
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async uploadCover(req, res) {
    if (!req.user.canUpload) {
      Logger.warn(`User "${req.user.username}" attempted to upload a cover without permission`)
      return res.sendStatus(403)
    }

    let coverPath = null

    if (req.body.url) {
      // Download from URL
      if (!req.body.url.startsWith?.('http:') && !req.body.url.startsWith?.('https:')) {
        Logger.error(`[SeriesController] Invalid request payload. Invalid url "${req.body.url}"`)
        return res.status(400).send(`Invalid request payload. Invalid url "${req.body.url}"`)
      }

      Logger.debug(`[SeriesController] Requesting download series cover from url "${req.body.url}"`)
      const result = await saveSeriesImage(req.series.id, req.body.url)

      if (result?.error) {
        return res.status(400).send(result.error)
      } else if (!result?.path) {
        return res.status(500).send('Unknown error occurred')
      }
      coverPath = result.path
    } else if (req.files?.cover) {
      // File upload
      Logger.debug(`[SeriesController] Handling uploaded cover file`)
      const result = await saveSeriesImageFromFile(req.series.id, req.files.cover)
      if (result?.error) {
        return res.status(400).send(result.error)
      } else if (!result?.path) {
        return res.status(500).send('Unknown error occurred')
      }
      coverPath = result.path
    } else if (req.body.cover) {
      // Base64 cover
      const result = await saveSeriesImageFromBase64(req.series.id, req.body.cover)
      if (result?.error) {
        return res.status(400).send(result.error)
      } else if (!result?.path) {
        return res.status(500).send('Unknown error occurred')
      }
      coverPath = result.path
    } else {
      Logger.error(`[SeriesController] Invalid request payload. 'url', 'cover', or file not in request`)
      return res.status(400).send(`Invalid request payload. 'url', 'cover', or file not in request`)
    }

    if (req.series.coverPath) {
      await CacheManager.purgeImageCache(req.series.id)
    }

    req.series.coverPath = coverPath
    req.series.changed('coverPath', true)
    await req.series.save()

    SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    res.json({
      series: req.series.toOldJSON()
    })
  }

  /**
   * DELETE: /api/series/:id/cover
   * Remove series cover image
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async deleteCover(req, res) {
    if (!req.series.coverPath) {
      Logger.error(`[SeriesController] Series "${req.series.name}" has no coverPath set`)
      return res.status(400).send('Series has no cover path set')
    }
    Logger.info(`[SeriesController] Removing cover for series "${req.series.name}" at "${req.series.coverPath}"`)
    await CacheManager.purgeImageCache(req.series.id)
    await CoverManager.removeFile(req.series.coverPath)
    req.series.coverPath = null
    await req.series.save()

    SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    res.json({
      series: req.series.toOldJSON()
    })
  }

  /**
   * GET: /api/series/:id/cover
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async getCover(req, res) {
    const {
      query: { width, height, format, raw }
    } = req

    if (req.query.ts) res.set('Cache-Control', 'private, max-age=86400')

    const seriesId = req.params.id
    if (!seriesId) {
      return res.sendStatus(400)
    }

    if (raw) {
      const series = await Database.seriesModel.findByPk(seriesId)
      if (!series) {
        Logger.warn(`[SeriesController] Series "${seriesId}" not found`)
        return res.sendStatus(404)
      }

      if (!series.coverPath || !(await fs.pathExists(series.coverPath))) {
        Logger.warn(`[SeriesController] Series "${series.name}" has invalid coverPath: ${series.coverPath}`)
        return res.sendStatus(404)
      }

      // any value
      if (global.XAccel) {
        const encodedURI = encodeUriPath(global.XAccel + series.coverPath)
        Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
        return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
      }

      return res.sendFile(series.coverPath)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return CacheManager.handleSeriesCache(res, seriesId, options)
  }

  /**
   * PATCH: /api/series/:id/books
   * Update book sequences in a series
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async updateBooks(req, res) {
    const { books } = req.body
    Logger.debug(`[SeriesController] updateBooks called for series "${req.series.id}" with ${books?.length || 0} books`)

    if (!Array.isArray(books)) {
      Logger.warn(`[SeriesController] Invalid request body - books is not an array`)
      return res.status(400).send('Invalid request body. "books" must be an array')
    }

    if (books.length === 0) {
      Logger.debug(`[SeriesController] No books to update`)
      return res.json({ success: true, updatedCount: 0 })
    }

    // Validate each book entry has bookId and sequence
    for (const book of books) {
      if (!book.bookId || book.sequence === undefined) {
        Logger.warn(`[SeriesController] Invalid book entry - missing bookId or sequence: ${JSON.stringify(book)}`)
        return res.status(400).send('Each book must have bookId and sequence')
      }
    }

    const updatedBooks = []
    for (const book of books) {
      Logger.debug(`[SeriesController] Looking for BookSeries with seriesId="${req.series.id}" and bookId="${book.bookId}"`)

      const bookSeries = await Database.bookSeriesModel.findOne({
        where: {
          seriesId: req.series.id,
          bookId: book.bookId
        }
      })

      if (bookSeries) {
        const newSequence = book.sequence === null ? null : String(book.sequence)
        Logger.debug(`[SeriesController] Found BookSeries. Current sequence: "${bookSeries.sequence}", new sequence: "${newSequence}"`)
        if (bookSeries.sequence !== newSequence) {
          bookSeries.sequence = newSequence
          await bookSeries.save()
          updatedBooks.push(book.bookId)
          Logger.debug(`[SeriesController] Updated sequence for bookId="${book.bookId}"`)
        }
      } else {
        Logger.warn(`[SeriesController] BookSeries not found for seriesId="${req.series.id}" and bookId="${book.bookId}"`)
      }
    }

    if (updatedBooks.length) {
      Logger.info(`[SeriesController] Updated sequences for ${updatedBooks.length} books in series "${req.series.name}"`)
      SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    }

    res.json({
      success: true,
      updatedCount: updatedBooks.length
    })
  }

  /**
   * DELETE: /api/series/:id/books/:bookId
   * Remove a book from a series
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async removeBook(req, res) {
    const bookId = req.params.bookId
    Logger.info(`[SeriesController] Removing book "${bookId}" from series "${req.series.name}"`)

    const bookSeries = await Database.bookSeriesModel.findOne({
      where: {
        seriesId: req.series.id,
        bookId: bookId
      }
    })

    if (!bookSeries) {
      Logger.warn(`[SeriesController] BookSeries not found for seriesId="${req.series.id}" and bookId="${bookId}"`)
      return res.status(404).send('Book not found in series')
    }

    await bookSeries.destroy()
    Logger.info(`[SeriesController] Removed book "${bookId}" from series "${req.series.name}"`)

    // Check if series is now empty and should be removed
    const remainingBooks = await Database.bookSeriesModel.count({
      where: {
        seriesId: req.series.id
      }
    })

    if (remainingBooks === 0) {
      Logger.info(`[SeriesController] Series "${req.series.name}" is now empty, removing series`)
      await this.removeSeries(req.series)
      SocketAuthority.emitter('series_removed', req.series.toOldJSON())
    } else {
      SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    }

    res.json({
      success: true
    })
  }

  /**
   * DELETE: /api/series/:id
   * Delete a series (removes all book-series associations)
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    Logger.info(`[SeriesController] Deleting series "${req.series.name}"`)

    await this.removeSeries(req.series)

    SocketAuthority.emitter('series_removed', req.series.toOldJSON())
    res.sendStatus(200)
  }

  /**
   * Helper method to remove a series and clean up related data
   * @param {import('../models/Series')} series
   */
  async removeSeries(series) {
    // Remove all book-series associations
    await Database.bookSeriesModel.destroy({
      where: {
        seriesId: series.id
      }
    })

    // Remove series cover if it exists
    if (series.coverPath) {
      await CacheManager.purgeImageCache(series.id)
      await CoverManager.removeFile(series.coverPath).catch((error) => {
        Logger.error(`[SeriesController] Failed to remove cover file at "${series.coverPath}"`, error)
      })
    }

    // Close RSS feed if open
    await RssFeedManager.closeFeedForEntityId(series.id)

    // Remove the series
    await series.destroy()
    Logger.info(`[SeriesController] Series "${series.name}" deleted successfully`)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const series = await Database.seriesModel.findByPk(req.params.id)
    if (!series) return res.sendStatus(404)

    /**
     * Filter out any library items not accessible to user
     */
    const libraryItems = await libraryItemsBookFilters.getLibraryItemsForSeries(series, req.user)
    if (!libraryItems.length) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to access series "${series.id}" with no accessible books`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.series = series
    req.libraryItemsInSeries = libraryItems
    next()
  }
}
module.exports = new SeriesController()
