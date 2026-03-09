const Path = require('path')
const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')
const fs = require('fs-extra')
const ffmpegHelpers = require('../utils/ffmpegHelpers')
const Task = require('../objects/Task')
const fileUtils = require('../utils/fileUtils')
const BaseTaskManager = require('./BaseTaskManager')

/**
 * @typedef UpdateMetadataOptions
 * @property {boolean} [forceEmbedChapters=false] - Whether to force embed chapters.
 * @property {boolean} [backup=false] - Whether to backup the files.
 */

class AudioMetadataManager extends BaseTaskManager {
  constructor() {
    super('AudioMetadataManager')
    this.itemsCacheDir = Path.join(global.MetadataPath, 'cache/items')
  }

  /**
   * @param {import('../models/LibraryItem')} libraryItem
   */
  getMetadataObjectForApi(libraryItem) {
    return ffmpegHelpers.getFFMetadataObject(libraryItem, libraryItem.media.includedAudioFiles.length)
  }

  /**
   * @param {string} userId
   * @param {import('../models/LibraryItem')[]} libraryItems
   * @param {UpdateMetadataOptions} options
   */
  handleBatchEmbed(userId, libraryItems, options = {}) {
    libraryItems.forEach((li) => {
      this.updateMetadataForItem(userId, li, options)
    })
  }

  /**
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {UpdateMetadataOptions} [options={}]
   */
  async updateMetadataForItem(userId, libraryItem, options = {}) {
    const forceEmbedChapters = !!options.forceEmbedChapters
    const backupFiles = !!options.backup

    const audioFiles = libraryItem.media.includedAudioFiles

    const task = new Task()

    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)

    // Only writing chapters for single file audiobooks
    const chapters = audioFiles.length == 1 || forceEmbedChapters ? libraryItem.media.chapters.map((c) => ({ ...c })) : null

    let mimeType = audioFiles[0].mimeType
    if (audioFiles.some((a) => a.mimeType !== mimeType)) mimeType = null

    // Create task
    const libraryItemDir = libraryItem.isFile ? Path.dirname(libraryItem.path) : libraryItem.path
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemDir,
      userId,
      audioFiles: audioFiles.map((af) => ({
        index: af.index,
        ino: af.ino,
        filename: af.metadata.filename,
        path: af.metadata.path,
        cachePath: Path.join(itemCachePath, af.metadata.filename),
        duration: af.duration
      })),
      coverPath: libraryItem.media.coverPath,
      metadataObject: ffmpegHelpers.getFFMetadataObject(libraryItem, audioFiles.length),
      itemCachePath,
      chapters,
      mimeType,
      options: {
        forceEmbedChapters,
        backupFiles
      },
      duration: libraryItem.media.duration
    }

    const taskTitleString = {
      text: 'Embedding Metadata',
      key: 'MessageTaskEmbeddingMetadata'
    }
    const taskDescriptionString = {
      text: `Embedding metadata in audiobook "${libraryItem.media.title}".`,
      key: 'MessageTaskEmbeddingMetadataDescription',
      subs: [libraryItem.media.title]
    }
    task.setData('embed-metadata', taskTitleString, taskDescriptionString, false, taskData)

    const queued = this.enqueueTask(task, `"${libraryItem.media.title}"`)
    if (queued) {
      SocketAuthority.adminEmitter('metadata_embed_queue_update', {
        libraryItemId: libraryItem.id,
        queued: true
      })
    }
  }

  /**
   * @param {import('../objects/Task')} task
   */
  async runTask(task) {
    this.startTask(task)

    Logger.info(`[AudioMetadataManager] Starting metadata embed task`, task.description)

    // Ensure target directory is writable
    const targetDirWritable = await fileUtils.isWritable(task.data.libraryItemDir)
    Logger.debug(`[AudioMetadataManager] Target directory ${task.data.libraryItemDir} writable: ${targetDirWritable}`)
    if (!targetDirWritable) {
      Logger.error(`[AudioMetadataManager] Target directory is not writable: ${task.data.libraryItemDir}`)
      task.setFailed({ text: 'Target directory is not writable', key: 'MessageTaskTargetDirectoryNotWritable' })
      this.handleTaskFinished(task)
      return
    }

    // Ensure target audio files are writable
    for (const af of task.data.audioFiles) {
      try {
        await fs.access(af.path, fs.constants.W_OK)
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Audio file is not writable: ${af.path}`)
        task.setFailed({
          text: `Audio file "${Path.basename(af.path)}" is not writable`,
          key: 'MessageTaskAudioFileNotWritable',
          subs: [Path.basename(af.path)]
        })
        this.handleTaskFinished(task)
        return
      }
    }

    // Ensure item cache dir exists
    let cacheDirCreated = false
    if (!(await fs.pathExists(task.data.itemCachePath))) {
      try {
        await fs.mkdir(task.data.itemCachePath)
        cacheDirCreated = true
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Failed to create cache directory ${task.data.itemCachePath}`, err)
        task.setFailed({ text: 'Failed to create cache directory', key: 'MessageTaskFailedToCreateCacheDirectory' })
        this.handleTaskFinished(task)
        return
      }
    }

    // Create ffmetadata file
    const ffmetadataPath = Path.join(task.data.itemCachePath, 'ffmetadata.txt')
    const success = await ffmpegHelpers.writeFFMetadataFile(task.data.metadataObject, task.data.chapters, ffmetadataPath)
    if (!success) {
      Logger.error(`[AudioMetadataManager] Failed to write ffmetadata file for audiobook "${task.data.libraryItemId}"`)
      task.setFailed({ text: 'Failed to write metadata file', key: 'MessageTaskFailedToWriteMetadataFile' })
      this.handleTaskFinished(task)
      return
    }

    // Tag audio files
    let cumulativeProgress = 0
    for (const af of task.data.audioFiles) {
      const audioFileRelativeDuration = af.duration / task.data.duration
      SocketAuthority.adminEmitter('track_started', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })

      // Backup audio file
      if (task.data.options.backupFiles) {
        try {
          const backupFilePath = Path.join(task.data.itemCachePath, af.filename)
          await fs.copy(af.path, backupFilePath)
          Logger.debug(`[AudioMetadataManager] Backed up audio file at "${backupFilePath}"`)
        } catch (err) {
          Logger.error(`[AudioMetadataManager] Failed to backup audio file "${af.path}"`, err)
          task.setFailed({
            text: `Failed to backup audio file "${Path.basename(af.path)}"`,
            key: 'MessageTaskFailedToBackupAudioFile',
            subs: [Path.basename(af.path)]
          })
          this.handleTaskFinished(task)
          return
        }
      }

      try {
        await ffmpegHelpers.addCoverAndMetadataToFile(af.path, task.data.coverPath, ffmetadataPath, af.index, task.data.mimeType, (progress) => {
          SocketAuthority.adminEmitter('task_progress', { libraryItemId: task.data.libraryItemId, progress: cumulativeProgress + progress * audioFileRelativeDuration })
          SocketAuthority.adminEmitter('track_progress', { libraryItemId: task.data.libraryItemId, ino: af.ino, progress })
        })
        Logger.info(`[AudioMetadataManager] Successfully tagged audio file "${af.path}"`)
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Failed to tag audio file "${af.path}"`, err)
        task.setFailed({
          text: `Failed to embed metadata in file "${Path.basename(af.path)}"`,
          key: 'MessageTaskFailedToEmbedMetadataInFile',
          subs: [Path.basename(af.path)]
        })
        this.handleTaskFinished(task)
        return
      }

      SocketAuthority.adminEmitter('track_finished', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })

      cumulativeProgress += audioFileRelativeDuration * 100
    }

    // Remove temp cache file/folder if not backing up
    if (!task.data.options.backupFiles) {
      if (cacheDirCreated) {
        await fs.remove(task.data.itemCachePath)
      } else {
        await fs.remove(ffmetadataPath)
      }
    }

    task.setFinished()
    this.handleTaskFinished(task)
  }

  onTaskDequeued(task) {
    SocketAuthority.emitter('metadata_embed_queue_update', {
      libraryItemId: task.data.libraryItemId,
      queued: false
    })
  }
}

module.exports = AudioMetadataManager
