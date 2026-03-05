const cron = require('node-cron')
const Logger = require('../Logger')
const Database = require('../Database')
const LibraryScanner = require('../scanner/LibraryScanner')

const ShareManager = require('./ShareManager')

class CronManager {
  constructor(playbackSessionManager) {
    /** @type {import('./PlaybackSessionManager')} */
    this.playbackSessionManager = playbackSessionManager

    this.libraryScanCrons = []
  }

  /**
   * Initialize library scan crons
   *
   * @param {import('../models/Library')[]} libraries
   */
  async init(libraries) {
    this.initOpenSessionCleanupCron()
    this.initLibraryScanCrons(libraries)
  }

  /**
   * Initialize open session & auth session cleanup cron
   * Runs every day at 00:30
   * Closes open share sessions that have not been updated in 24 hours
   * Closes open playback sessions that have not been updated in 36 hours
   * Cleans up expired auth sessions
   * Deactivates expired api keys
   */
  initOpenSessionCleanupCron() {
    cron.schedule('30 0 * * *', async () => {
      Logger.debug('[CronManager] Open session cleanup cron executing')
      ShareManager.closeStaleOpenShareSessions()
      await this.playbackSessionManager.closeStaleOpenSessions()
      await Database.cleanupExpiredSessions()
      await Database.deactivateExpiredApiKeys()
    })
  }

  /**
   * Initialize library scan crons
   * @param {import('../models/Library')[]} libraries
   */
  initLibraryScanCrons(libraries) {
    for (const library of libraries) {
      if (library.settings.autoScanCronExpression) {
        this.startCronForLibrary(library)
      }
    }
  }

  /**
   * Start cron schedule for library
   *
   * @param {import('../models/Library')} _library
   */
  startCronForLibrary(_library) {
    Logger.debug(`[CronManager] Init library scan cron for ${_library.name} on schedule ${_library.settings.autoScanCronExpression}`)
    const libScanCron = cron.schedule(_library.settings.autoScanCronExpression, async () => {
      const library = await Database.libraryModel.findByIdWithFolders(_library.id)
      if (!library) {
        Logger.error(`[CronManager] Library not found for scan cron ${_library.id}`)
      } else {
        Logger.debug(`[CronManager] Library scan cron executing for ${library.name}`)
        LibraryScanner.scan(library)
      }
    })
    this.libraryScanCrons.push({
      libraryId: _library.id,
      expression: _library.settings.autoScanCronExpression,
      task: libScanCron
    })
  }

  /**
   *
   * @param {import('../models/Library')} library
   */
  removeCronForLibrary(library) {
    Logger.debug(`[CronManager] Removing library scan cron for ${library.name}`)
    this.libraryScanCrons = this.libraryScanCrons.filter((lsc) => lsc.libraryId !== library.id)
  }

  /**
   *
   * @param {import('../models/Library')} library
   */
  updateLibraryScanCron(library) {
    const expression = library.settings.autoScanCronExpression
    const existingCron = this.libraryScanCrons.find((lsc) => lsc.libraryId === library.id)

    if (!expression && existingCron) {
      if (existingCron.task.stop) existingCron.task.stop()

      this.removeCronForLibrary(library)
    } else if (!existingCron && expression) {
      this.startCronForLibrary(library)
    } else if (existingCron && existingCron.expression !== expression) {
      if (existingCron.task.stop) existingCron.task.stop()

      this.removeCronForLibrary(library)
      this.startCronForLibrary(library)
    }
  }
}
module.exports = CronManager
