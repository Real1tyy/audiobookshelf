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
const { downloadImageFile } = require('../utils/fileUtils')

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
   * Upload series cover image from URL or base64
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
      const result = await this.saveSeriesImage(req.series.id, req.body.url)

      if (result?.error) {
        return res.status(400).send(result.error)
      } else if (!result?.path) {
        return res.status(500).send('Unknown error occurred')
      }
      coverPath = result.path
    } else if (req.body.cover) {
      // Base64 cover
      const result = await this.saveSeriesImageFromBase64(req.series.id, req.body.cover)
      if (result?.error) {
        return res.status(400).send(result.error)
      } else if (!result?.path) {
        return res.status(500).send('Unknown error occurred')
      }
      coverPath = result.path
    } else {
      Logger.error(`[SeriesController] Invalid request payload. 'url' or 'cover' not in request body`)
      return res.status(400).send(`Invalid request payload. 'url' or 'cover' not in request body`)
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

    const seriesId = req.params.id

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
   * Save series image from URL
   * @param {string} seriesId
   * @param {string} url
   * @returns {Promise<{path?: string, error?: string}>}
   */
  async saveSeriesImage(seriesId, url) {
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
  async saveSeriesImageFromBase64(seriesId, base64Data) {
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
