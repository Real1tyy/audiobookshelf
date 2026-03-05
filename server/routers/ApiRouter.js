const express = require('express')
const Path = require('path')
const sequelize = require('sequelize')

const Logger = require('../Logger')
const { requireAdmin } = require('../middleware')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')

const fs = require('fs-extra')
const date = require('date-and-time')

const CacheManager = require('../managers/CacheManager')

const LibraryController = require('../controllers/LibraryController')
const UserController = require('../controllers/UserController')
const MeController = require('../controllers/MeController')
const BackupController = require('../controllers/BackupController')
const LibraryItemController = require('../controllers/LibraryItemController')
const SeriesController = require('../controllers/SeriesController')
const FileSystemController = require('../controllers/FileSystemController')
const AuthorController = require('../controllers/AuthorController')
const SessionController = require('../controllers/SessionController')
const EmailController = require('../controllers/EmailController')
const SearchController = require('../controllers/SearchController')
const CacheController = require('../controllers/CacheController')
const ToolsController = require('../controllers/ToolsController')
const CustomMetadataProviderController = require('../controllers/CustomMetadataProviderController')
const MiscController = require('../controllers/MiscController')
const ShareController = require('../controllers/ShareController')
const StatsController = require('../controllers/StatsController')
const ApiKeyController = require('../controllers/ApiKeyController')

class ApiRouter {
  constructor(Server) {
    /** @type {import('../Auth')} */
    this.auth = Server.auth
    /** @type {import('../managers/PlaybackSessionManager')} */
    this.playbackSessionManager = Server.playbackSessionManager
    /** @type {import('../managers/AbMergeManager')} */
    this.abMergeManager = Server.abMergeManager
    /** @type {import('../managers/BackupManager')} */
    this.backupManager = Server.backupManager
    /** @type {import('../managers/AudioMetadataManager')} */
    this.audioMetadataManager = Server.audioMetadataManager
    /** @type {import('../managers/AudioTrimManager')} */
    this.audioTrimManager = Server.audioTrimManager
    /** @type {import('../managers/AudioExtractManager')} */
    this.audioExtractManager = Server.audioExtractManager
    /** @type {import('../managers/CronManager')} */
    this.cronManager = Server.cronManager
    /** @type {import('../managers/EmailManager')} */
    this.emailManager = Server.emailManager
    this.apiCacheManager = Server.apiCacheManager

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    //
    // Library Routes
    //
    this.router.get(/^\/libraries/, this.apiCacheManager.middleware)
    this.router.post('/libraries', requireAdmin, LibraryController.create.bind(this))
    this.router.get('/libraries', LibraryController.findAll.bind(this))
    this.router.get('/libraries/:id', LibraryController.middleware.bind(this), LibraryController.findOne.bind(this))
    this.router.patch('/libraries/:id', requireAdmin, LibraryController.middleware.bind(this), LibraryController.update.bind(this))
    this.router.delete('/libraries/:id', requireAdmin, LibraryController.middleware.bind(this), LibraryController.delete.bind(this))

    this.router.get('/libraries/:id/items', LibraryController.middleware.bind(this), LibraryController.getLibraryItems.bind(this))
    this.router.delete('/libraries/:id/issues', requireAdmin, LibraryController.middleware.bind(this), LibraryController.removeLibraryItemsWithIssues.bind(this))
    this.router.get('/libraries/:id/series', LibraryController.middleware.bind(this), LibraryController.getAllSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/series/:seriesId', LibraryController.middleware.bind(this), LibraryController.getSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/personalized', LibraryController.middleware.bind(this), LibraryController.getUserPersonalizedShelves.bind(this))
    this.router.get('/libraries/:id/filterdata', LibraryController.middleware.bind(this), LibraryController.getLibraryFilterData.bind(this))
    this.router.get('/libraries/:id/search', LibraryController.middleware.bind(this), LibraryController.search.bind(this))
    this.router.get('/libraries/:id/search-transcripts', LibraryController.middleware.bind(this), LibraryController.searchTranscripts.bind(this))
    this.router.post('/libraries/:id/reindex-transcripts', LibraryController.middleware.bind(this), LibraryController.reindexTranscripts.bind(this))
    this.router.get('/libraries/:id/stats', LibraryController.middleware.bind(this), LibraryController.stats.bind(this))
    this.router.get('/libraries/:id/authors', LibraryController.middleware.bind(this), LibraryController.getAuthors.bind(this))
    this.router.get('/libraries/:id/tags', LibraryController.middleware.bind(this), LibraryController.getTags.bind(this))
    this.router.patch('/libraries/:id/tags/:tagId', LibraryController.middleware.bind(this), LibraryController.updateTag.bind(this))
    this.router.delete('/libraries/:id/tags/:tagId', LibraryController.middleware.bind(this), LibraryController.removeTag.bind(this))
    this.router.get('/libraries/:id/matchall', requireAdmin, LibraryController.middleware.bind(this), LibraryController.matchAll.bind(this))
    this.router.post('/libraries/:id/scan', requireAdmin, LibraryController.middleware.bind(this), LibraryController.scan.bind(this))
    this.router.post('/libraries/order', requireAdmin, LibraryController.reorder.bind(this))
    this.router.post('/libraries/:id/remove-metadata', requireAdmin, LibraryController.middleware.bind(this), LibraryController.removeAllMetadataFiles.bind(this))
    this.router.get('/libraries/:id/download', LibraryController.middleware.bind(this), LibraryController.downloadMultiple.bind(this))

    //
    // YouTube Routes
    //
    this.router.post('/youtube/transcript', LibraryItemController.fetchYouTubeTranscript.bind(this))

    //
    // Item Routes
    //
    this.router.post('/items', LibraryItemController.create.bind(this))
    this.router.post('/items/batch/delete', LibraryItemController.batchDelete.bind(this))
    this.router.post('/items/batch/update', LibraryItemController.batchUpdate.bind(this))
    this.router.post('/items/batch/get', LibraryItemController.batchGet.bind(this))
    this.router.post('/items/batch/quickmatch', requireAdmin, LibraryItemController.batchQuickMatch.bind(this))
    this.router.post('/items/batch/scan', requireAdmin, LibraryItemController.batchScan.bind(this))

    this.router.get('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.findOne.bind(this))
    this.router.delete('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.delete.bind(this))
    this.router.get('/items/:id/download', LibraryItemController.middleware.bind(this), LibraryItemController.download.bind(this))
    this.router.patch('/items/:id/media', LibraryItemController.middleware.bind(this), LibraryItemController.updateMedia.bind(this))
    this.router.get('/items/:id/cover', LibraryItemController.getCover.bind(this))
    this.router.post('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.uploadCover.bind(this))
    this.router.patch('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.updateCover.bind(this))
    this.router.delete('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.removeCover.bind(this))
    this.router.post('/items/:id/match', LibraryItemController.middleware.bind(this), LibraryItemController.match.bind(this))
    this.router.post('/items/:id/play', LibraryItemController.middleware.bind(this), LibraryItemController.startPlaybackSession.bind(this))
    this.router.patch('/items/:id/tracks', LibraryItemController.middleware.bind(this), LibraryItemController.updateTracks.bind(this))
    this.router.post('/items/:id/scan', requireAdmin, LibraryItemController.middleware.bind(this), LibraryItemController.scan.bind(this))
    this.router.get('/items/:id/metadata-object', requireAdmin, LibraryItemController.middleware.bind(this), LibraryItemController.getMetadataObject.bind(this))
    this.router.post('/items/:id/chapters', LibraryItemController.middleware.bind(this), LibraryItemController.updateMediaChapters.bind(this))
    this.router.get('/items/:id/ffprobe/:fileid', requireAdmin, LibraryItemController.middleware.bind(this), LibraryItemController.getFFprobeData.bind(this))
    this.router.get('/items/:id/file/:fileid', LibraryItemController.middleware.bind(this), LibraryItemController.getLibraryFile.bind(this))
    this.router.delete('/items/:id/file/:fileid', LibraryItemController.middleware.bind(this), LibraryItemController.deleteLibraryFile.bind(this))
    this.router.get('/items/:id/file/:fileid/download', LibraryItemController.middleware.bind(this), LibraryItemController.downloadLibraryFile.bind(this))
    this.router.get('/items/:id/ebook/:fileid?', LibraryItemController.middleware.bind(this), LibraryItemController.getEBookFile.bind(this))
    this.router.patch('/items/:id/ebook/:fileid/status', LibraryItemController.middleware.bind(this), LibraryItemController.updateEbookFileStatus.bind(this))

    //
    // User Routes
    //
    this.router.post('/users', UserController.middleware.bind(this), UserController.create.bind(this))
    this.router.get('/users', requireAdmin, UserController.middleware.bind(this), UserController.findAll.bind(this))
    this.router.get('/users/online', requireAdmin, UserController.getOnlineUsers.bind(this))
    this.router.get('/users/:id', UserController.middleware.bind(this), UserController.findOne.bind(this))
    this.router.patch('/users/:id', UserController.middleware.bind(this), UserController.update.bind(this))
    this.router.delete('/users/:id', UserController.middleware.bind(this), UserController.delete.bind(this))
    this.router.patch('/users/:id/openid-unlink', UserController.middleware.bind(this), UserController.unlinkFromOpenID.bind(this))
    this.router.get('/users/:id/listening-sessions', UserController.middleware.bind(this), UserController.getListeningSessions.bind(this))
    this.router.get('/users/:id/listening-stats', UserController.middleware.bind(this), UserController.getListeningStats.bind(this))

    //
    // Current User Routes (Me)
    //
    this.router.get('/me', MeController.getCurrentUser.bind(this))
    this.router.get('/me/listening-sessions', MeController.getListeningSessions.bind(this))
    this.router.get('/me/item/listening-sessions/:libraryItemId', MeController.getItemListeningSessions.bind(this))
    this.router.get('/me/listening-stats', MeController.getListeningStats.bind(this))
    this.router.get('/me/progress/:id/remove-from-continue-listening', MeController.removeItemFromContinueListening.bind(this))
    this.router.get('/me/progress/:id', MeController.getMediaProgress.bind(this))
    this.router.patch('/me/progress/batch/update', MeController.batchUpdateMediaProgress.bind(this))
    this.router.patch('/me/progress/:libraryItemId', MeController.createUpdateMediaProgress.bind(this))
    this.router.delete('/me/progress/:id', MeController.removeMediaProgress.bind(this))
    this.router.post('/me/item/:id/bookmark', MeController.createBookmark.bind(this))
    this.router.patch('/me/item/:id/bookmark', MeController.updateBookmark.bind(this))
    this.router.delete('/me/item/:id/bookmark/:time', MeController.removeBookmark.bind(this))
    this.router.patch('/me/password', this.auth.authRateLimiter, MeController.updatePassword.bind(this))
    this.router.get('/me/items-in-progress', MeController.getAllLibraryItemsInProgress.bind(this))
    this.router.get('/me/series/:id/remove-from-continue-listening', MeController.removeSeriesFromContinueListening.bind(this))
    this.router.get('/me/series/:id/readd-to-continue-listening', MeController.readdSeriesFromContinueListening.bind(this))
    this.router.get('/me/stats/year/:year', MeController.getStatsForYear.bind(this))
    this.router.post('/me/ereader-devices', MeController.updateUserEReaderDevices.bind(this))
    this.router.get('/me/queue', MeController.getPlayerQueue.bind(this))
    this.router.post('/me/queue', MeController.savePlayerQueue.bind(this))
    this.router.delete('/me/queue', MeController.clearPlayerQueue.bind(this))
    this.router.get('/me/series-progress/:seriesId', MeController.getSeriesProgress.bind(this))
    this.router.patch('/me/series-progress/:seriesId', MeController.updateSeriesProgress.bind(this))
    this.router.delete('/me/series-progress/:seriesId', MeController.deleteSeriesProgress.bind(this))

    //
    // Backup Routes
    //
    this.router.get('/backups', requireAdmin, BackupController.middleware.bind(this), BackupController.getAll.bind(this))
    this.router.post('/backups', requireAdmin, BackupController.middleware.bind(this), BackupController.create.bind(this))
    this.router.delete('/backups/:id', requireAdmin, BackupController.middleware.bind(this), BackupController.delete.bind(this))
    this.router.get('/backups/:id/download', requireAdmin, BackupController.middleware.bind(this), BackupController.download.bind(this))
    this.router.get('/backups/:id/apply', requireAdmin, BackupController.middleware.bind(this), BackupController.apply.bind(this))
    this.router.post('/backups/upload', requireAdmin, BackupController.middleware.bind(this), BackupController.upload.bind(this))
    this.router.patch('/backups/path', requireAdmin, BackupController.middleware.bind(this), BackupController.updatePath.bind(this))

    //
    // File System Routes
    //
    this.router.get('/filesystem', requireAdmin, FileSystemController.getPaths.bind(this))
    this.router.post('/filesystem/pathexists', FileSystemController.checkPathExists.bind(this))

    //
    // Author Routes
    //
    this.router.get('/authors/:id', AuthorController.middleware.bind(this), AuthorController.findOne.bind(this))
    this.router.patch('/authors/:id', AuthorController.middleware.bind(this), AuthorController.update.bind(this))
    this.router.delete('/authors/:id', AuthorController.middleware.bind(this), AuthorController.delete.bind(this))
    this.router.post('/authors/:id/match', AuthorController.middleware.bind(this), AuthorController.match.bind(this))
    this.router.get('/authors/:id/listening-stats', AuthorController.middleware.bind(this), AuthorController.getListeningStats.bind(this))
    this.router.get('/authors/:id/image', AuthorController.getImage.bind(this))
    this.router.post('/authors/:id/image', AuthorController.middleware.bind(this), AuthorController.uploadImage.bind(this))
    this.router.delete('/authors/:id/image', AuthorController.middleware.bind(this), AuthorController.deleteImage.bind(this))

    //
    // Series Routes
    //
    this.router.get('/series/:id', SeriesController.middleware.bind(SeriesController), SeriesController.findOne.bind(SeriesController))
    this.router.patch('/series/:id', SeriesController.middleware.bind(SeriesController), SeriesController.update.bind(SeriesController))
    this.router.delete('/series/:id', SeriesController.middleware.bind(SeriesController), SeriesController.delete.bind(SeriesController))
    this.router.patch('/series/:id/books', SeriesController.middleware.bind(SeriesController), SeriesController.updateBooks.bind(SeriesController))
    this.router.delete('/series/:id/books/:bookId', SeriesController.middleware.bind(SeriesController), SeriesController.removeBook.bind(SeriesController))
    this.router.post('/series/:id/cover', SeriesController.middleware.bind(SeriesController), SeriesController.uploadCover.bind(SeriesController))
    this.router.delete('/series/:id/cover', SeriesController.middleware.bind(SeriesController), SeriesController.deleteCover.bind(SeriesController))
    this.router.get('/series/:id/cover', SeriesController.getCover.bind(SeriesController))

    //
    // Playback Session Routes
    //
    this.router.get('/sessions', requireAdmin, SessionController.getAllWithUserData.bind(this))
    this.router.delete('/sessions/:id', SessionController.middleware.bind(this), SessionController.delete.bind(this))
    this.router.get('/sessions/open', requireAdmin, SessionController.getOpenSessions.bind(this))
    this.router.post('/sessions/batch/delete', requireAdmin, SessionController.batchDelete.bind(this))
    this.router.post('/session/local', SessionController.syncLocal.bind(this))
    this.router.post('/session/local-all', SessionController.syncLocalSessions.bind(this))
    // TODO: Update these endpoints because they are only for open playback sessions
    this.router.get('/session/:id', SessionController.openSessionMiddleware.bind(this), SessionController.getOpenSession.bind(this))
    this.router.post('/session/:id/sync', SessionController.openSessionMiddleware.bind(this), SessionController.sync.bind(this))
    this.router.post('/session/:id/close', SessionController.openSessionMiddleware.bind(this), SessionController.close.bind(this))

    //
    // Email Routes (Admin and up)
    //
    this.router.get('/emails/settings', EmailController.adminMiddleware.bind(this), EmailController.getSettings.bind(this))
    this.router.patch('/emails/settings', EmailController.adminMiddleware.bind(this), EmailController.updateSettings.bind(this))
    this.router.post('/emails/test', EmailController.adminMiddleware.bind(this), EmailController.sendTest.bind(this))
    this.router.post('/emails/ereader-devices', EmailController.adminMiddleware.bind(this), EmailController.updateEReaderDevices.bind(this))
    this.router.post('/emails/send-ebook-to-device', EmailController.sendEBookToDevice.bind(this))

    //
    // Search Routes
    //
    this.router.get('/search/covers', SearchController.findCovers.bind(this))
    this.router.get('/search/books', SearchController.findBooks.bind(this))
    this.router.get('/search/authors', SearchController.findAuthor.bind(this))
    this.router.get('/search/chapters', SearchController.findChapters.bind(this))
    this.router.get('/search/providers', SearchController.getAllProviders.bind(this))

    //
    // Cache Routes (Admin and up)
    //
    this.router.post('/cache/purge', requireAdmin, CacheController.purgeCache.bind(this))
    this.router.post('/cache/items/purge', requireAdmin, CacheController.purgeItemsCache.bind(this))

    //
    // Tools Routes (Admin and up)
    //
    this.router.post('/tools/item/:id/encode-m4b', requireAdmin, ToolsController.middleware.bind(this), ToolsController.encodeM4b.bind(this))
    this.router.delete('/tools/item/:id/encode-m4b', requireAdmin, ToolsController.middleware.bind(this), ToolsController.cancelM4bEncode.bind(this))
    this.router.post('/tools/item/:id/embed-metadata', requireAdmin, ToolsController.middleware.bind(this), ToolsController.embedAudioFileMetadata.bind(this))
    this.router.post('/tools/batch/embed-metadata', requireAdmin, ToolsController.middleware.bind(this), ToolsController.batchEmbedMetadata.bind(this))
    this.router.post('/tools/item/:id/trim-audio', requireAdmin, ToolsController.middleware.bind(this), ToolsController.trimAudio.bind(this))
    this.router.post('/tools/item/:id/extract-highlight', requireAdmin, ToolsController.middleware.bind(this), ToolsController.extractHighlight.bind(this))

    //
    // Custom Metadata Provider routes
    //
    this.router.get('/custom-metadata-providers', requireAdmin, CustomMetadataProviderController.middleware.bind(this), CustomMetadataProviderController.getAll.bind(this))
    this.router.post('/custom-metadata-providers', requireAdmin, CustomMetadataProviderController.middleware.bind(this), CustomMetadataProviderController.create.bind(this))
    this.router.delete('/custom-metadata-providers/:id', requireAdmin, CustomMetadataProviderController.middleware.bind(this), CustomMetadataProviderController.delete.bind(this))

    //
    // Share routes
    //
    this.router.get('/share/mediaitem', requireAdmin, ShareController.getMediaItemShares.bind(this))
    this.router.post('/share/mediaitem', requireAdmin, ShareController.createMediaItemShare.bind(this))
    this.router.delete('/share/mediaitem/:id', requireAdmin, ShareController.deleteMediaItemShare.bind(this))

    //
    // Stats Routes
    //
    this.router.get('/stats/year/:year', requireAdmin, StatsController.getAdminStatsForYear.bind(this))
    this.router.get('/stats/server', requireAdmin, StatsController.getServerStats.bind(this))

    //
    // API Key Routes
    //
    this.router.get('/api-keys', requireAdmin, ApiKeyController.getAll.bind(this))
    this.router.post('/api-keys', requireAdmin, ApiKeyController.create.bind(this))
    this.router.patch('/api-keys/:id', requireAdmin, ApiKeyController.update.bind(this))
    this.router.delete('/api-keys/:id', requireAdmin, ApiKeyController.delete.bind(this))

    //
    // Misc Routes
    //
    this.router.post('/upload', MiscController.handleUpload.bind(this))
    this.router.get('/tasks', MiscController.getTasks.bind(this))
    this.router.patch('/settings', requireAdmin, MiscController.updateServerSettings.bind(this))
    this.router.patch('/sorting-prefixes', requireAdmin, MiscController.updateSortingPrefixes.bind(this))
    this.router.post('/authorize', MiscController.authorize.bind(this))
    this.router.get('/tags', requireAdmin, MiscController.getAllTags.bind(this))
    this.router.post('/tags/rename', requireAdmin, MiscController.renameTag.bind(this))
    this.router.delete('/tags/:tag', requireAdmin, MiscController.deleteTag.bind(this))
    this.router.get('/genres', requireAdmin, MiscController.getAllGenres.bind(this))
    this.router.post('/genres/rename', requireAdmin, MiscController.renameGenre.bind(this))
    this.router.delete('/genres/:genre', requireAdmin, MiscController.deleteGenre.bind(this))
    this.router.post('/validate-cron', MiscController.validateCronExpression.bind(this))
    this.router.get('/auth-settings', requireAdmin, MiscController.getAuthSettings.bind(this))
    this.router.patch('/auth-settings', requireAdmin, MiscController.updateAuthSettings.bind(this))
    this.router.post('/watcher/update', requireAdmin, MiscController.updateWatchedPath.bind(this))
    this.router.get('/logger-data', requireAdmin, MiscController.getLoggerData.bind(this))
  }

  //
  // Helper Methods
  //
  /**
   * Remove library item and associated entities
   * @param {string} libraryItemId
   * @param {string[]} mediaItemIds array of bookId
   */
  async handleDeleteLibraryItem(libraryItemId, mediaItemIds) {
    const numProgressRemoved = await Database.mediaProgressModel.destroy({
      where: {
        mediaItemId: mediaItemIds
      }
    })
    if (numProgressRemoved > 0) {
      Logger.info(`[ApiRouter] Removed ${numProgressRemoved} media progress entries for library item "${libraryItemId}"`)
    }

    // purge cover cache
    await CacheManager.purgeCoverCache(libraryItemId)

    // Remove metadata file if in /metadata/items dir
    if (global.MetadataPath) {
      const itemMetadataPath = Path.join(global.MetadataPath, 'items', libraryItemId)
      if (await fs.pathExists(itemMetadataPath)) {
        Logger.info(`[ApiRouter] Removing item metadata at "${itemMetadataPath}"`)
        await fs.remove(itemMetadataPath)
      }
    }

    await Database.libraryItemModel.removeById(libraryItemId)

    SocketAuthority.emitter('item_removed', {
      id: libraryItemId
    })
  }

  /**
   * After deleting book(s), remove empty series
   *
   * @param {string[]} seriesIds
   */
  async checkRemoveEmptySeries(seriesIds) {
    if (!seriesIds?.length) return

    const transaction = await Database.sequelize.transaction()
    try {
      const seriesToRemove = (
        await Database.seriesModel.findAll({
          where: [
            {
              id: seriesIds
            },
            sequelize.where(sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 0)
          ],
          attributes: ['id', 'name', 'libraryId'],
          include: {
            model: Database.bookModel,
            attributes: ['id'],
            required: false // Ensure it includes series even if no books exist
          },
          transaction
        })
      ).map((s) => ({ id: s.id, name: s.name, libraryId: s.libraryId }))

      if (seriesToRemove.length) {
        await Database.seriesModel.destroy({
          where: {
            id: seriesToRemove.map((s) => s.id)
          },
          transaction
        })
      }

      await transaction.commit()

      seriesToRemove.forEach(({ id, name, libraryId }) => {
        Logger.info(`[ApiRouter] Series "${name}" is now empty. Removing series`)

        // Remove series from library filter data
        Database.removeSeriesFromFilterData(libraryId, id)
        SocketAuthority.emitter('series_removed', { id: id, libraryId: libraryId })
      })
    } catch (error) {
      await transaction.rollback()
      Logger.error(`[ApiRouter] Error removing empty series: ${error.message}`)
    }
  }

  /**
   * Remove authors with no books and unset asin, description and imagePath
   * Note: Other implementation is in BookScanner.checkAuthorsRemovedFromBooks (can be merged)
   *
   * @param {string[]} authorIds
   * @returns {Promise<void>}
   */
  async checkRemoveAuthorsWithNoBooks(authorIds) {
    if (!authorIds?.length) return

    const transaction = await Database.sequelize.transaction()
    try {
      // Select authors with locking to prevent concurrent updates
      const bookAuthorsToRemove = (
        await Database.authorModel.findAll({
          where: [
            {
              id: authorIds,
              asin: {
                [sequelize.Op.or]: [null, '']
              },
              description: {
                [sequelize.Op.or]: [null, '']
              },
              imagePath: {
                [sequelize.Op.or]: [null, '']
              }
            },
            sequelize.where(sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 0)
          ],
          attributes: ['id', 'name', 'libraryId'],
          raw: true,
          transaction
        })
      ).map((au) => ({ id: au.id, name: au.name, libraryId: au.libraryId }))

      if (bookAuthorsToRemove.length) {
        await Database.authorModel.destroy({
          where: {
            id: bookAuthorsToRemove.map((au) => au.id)
          },
          transaction
        })
      }

      await transaction.commit()

      // Remove all book authors after completing remove from database
      bookAuthorsToRemove.forEach(({ id, name, libraryId }) => {
        Database.removeAuthorFromFilterData(libraryId, id)
        // TODO: Clients were expecting full author in payload but its unnecessary
        SocketAuthority.emitter('author_removed', { id, libraryId })
        Logger.info(`[ApiRouter] Removed author "${name}" with no books`)
      })
    } catch (error) {
      await transaction.rollback()
      Logger.error(`[ApiRouter] Error removing authors: ${error.message}`)
    }
  }

  async getUserListeningSessionsHelper(userId) {
    const userSessions = await Database.getPlaybackSessions({ userId })
    return userSessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getUserItemListeningSessionsHelper(userId, mediaItemId) {
    const userSessions = await Database.getPlaybackSessions({ userId, mediaItemId })
    return userSessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getUserListeningStatsHelpers(userId) {
    const today = date.format(new Date(), 'YYYY-MM-DD')

    const listeningSessions = await this.getUserListeningSessionsHelper(userId)
    const listeningStats = {
      totalTime: 0,
      items: {},
      days: {},
      dayOfWeek: {},
      today: 0,
      recentSessions: listeningSessions.slice(0, 10)
    }
    listeningSessions.forEach((s) => {
      let sessionTimeListening = s.timeListening
      if (typeof sessionTimeListening == 'string') {
        sessionTimeListening = Number(sessionTimeListening)
      }

      if (s.dayOfWeek) {
        if (!listeningStats.dayOfWeek[s.dayOfWeek]) listeningStats.dayOfWeek[s.dayOfWeek] = 0
        listeningStats.dayOfWeek[s.dayOfWeek] += sessionTimeListening
      }
      if (s.date && sessionTimeListening > 0) {
        if (!listeningStats.days[s.date]) listeningStats.days[s.date] = 0
        listeningStats.days[s.date] += sessionTimeListening

        if (s.date === today) {
          listeningStats.today += sessionTimeListening
        }
      }
      if (!listeningStats.items[s.libraryItemId]) {
        listeningStats.items[s.libraryItemId] = {
          id: s.libraryItemId,
          timeListening: sessionTimeListening,
          mediaMetadata: s.mediaMetadata,
          lastUpdate: s.lastUpdate
        }
      } else {
        listeningStats.items[s.libraryItemId].timeListening += sessionTimeListening
      }

      listeningStats.totalTime += sessionTimeListening
    })
    return listeningStats
  }
}
module.exports = ApiRouter
