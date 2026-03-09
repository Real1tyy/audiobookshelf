const Path = require('path')
const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')
const fs = require('fs-extra')
const ffmpegHelpers = require('../utils/ffmpegHelpers')
const Task = require('../objects/Task')
const fileUtils = require('../utils/fileUtils')
const Database = require('../Database')
const LibraryItemScanner = require('../scanner/LibraryItemScanner')
const BaseTaskManager = require('./BaseTaskManager')

class AudioTrimManager extends BaseTaskManager {
  constructor() {
    super('AudioTrimManager')
  }

  /**
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {Array<{start: number, end: number}>} sectionsToRemove
   */
  async trimAudioForItem(userId, libraryItem, sectionsToRemove) {
    const audioFiles = libraryItem.media.includedAudioFiles
    const libraryItemDir = libraryItem.isFile ? Path.dirname(libraryItem.path) : libraryItem.path

    const task = new Task()
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemDir,
      userId,
      audioFiles: audioFiles.map((af) => ({
        index: af.index,
        ino: af.ino,
        filename: af.metadata.filename,
        path: af.metadata.path,
        duration: af.duration
      })),
      sectionsToRemove,
      duration: libraryItem.media.duration
    }

    const taskTitleString = {
      text: 'Trimming Audio',
      key: 'MessageTaskTrimmingAudio'
    }
    const taskDescriptionString = {
      text: `Trimming audio for "${libraryItem.media.title}".`,
      key: 'MessageTaskTrimmingAudioDescription',
      subs: [libraryItem.media.title]
    }
    task.setData('trim-audio', taskTitleString, taskDescriptionString, false, taskData)

    this.enqueueTask(task, `"${libraryItem.media.title}"`)
  }

  /**
   * Map global timeline sections to per-file local sections.
   *
   * @param {Array<{start: number, end: number}>} globalSections
   * @param {Array<{index: number, duration: number, path: string, ino: string, filename: string}>} audioFiles
   * @returns {Map<number, Array<{start: number, end: number}>>}
   */
  mapSectionsToFiles(globalSections, audioFiles) {
    const fileLocalSections = new Map()
    let cumulativeOffset = 0

    for (const af of audioFiles) {
      const fileStart = cumulativeOffset
      const fileEnd = cumulativeOffset + af.duration
      const localSections = []

      for (const section of globalSections) {
        if (section.start < fileEnd && section.end > fileStart) {
          const localStart = Math.max(0, section.start - fileStart)
          const localEnd = Math.min(af.duration, section.end - fileStart)
          if (localEnd > localStart) {
            localSections.push({ start: localStart, end: localEnd })
          }
        }
      }

      if (localSections.length > 0) {
        fileLocalSections.set(af.index, localSections)
      }

      cumulativeOffset += af.duration
    }

    return fileLocalSections
  }

  /**
   * @param {import('../objects/Task')} task
   */
  async runTask(task) {
    this.startTask(task)

    Logger.info(`[AudioTrimManager] Starting trim task`, task.description)

    // Ensure target directory is writable
    const targetDirWritable = await fileUtils.isWritable(task.data.libraryItemDir)
    if (!targetDirWritable) {
      Logger.error(`[AudioTrimManager] Target directory is not writable: ${task.data.libraryItemDir}`)
      task.setFailed({ text: 'Target directory is not writable', key: 'MessageTaskTargetDirectoryNotWritable' })
      this.handleTaskFinished(task)
      return
    }

    // Ensure target audio files are writable
    for (const af of task.data.audioFiles) {
      try {
        await fs.access(af.path, fs.constants.W_OK)
      } catch (err) {
        Logger.error(`[AudioTrimManager] Audio file is not writable: ${af.path}`)
        task.setFailed({ text: `Audio file "${Path.basename(af.path)}" is not writable`, key: 'MessageTaskAudioFileNotWritable', subs: [Path.basename(af.path)] })
        this.handleTaskFinished(task)
        return
      }
    }

    // Map global sections to per-file local sections
    const fileLocalSections = this.mapSectionsToFiles(task.data.sectionsToRemove, task.data.audioFiles)

    if (fileLocalSections.size === 0) {
      Logger.warn(`[AudioTrimManager] No audio files overlap with the specified sections`)
      task.setFailed({ text: 'No audio files overlap with the specified sections', key: 'MessageTaskNoOverlappingSections' })
      this.handleTaskFinished(task)
      return
    }

    // Process each file that has overlapping sections
    let cumulativeProgress = 0
    const totalFilesAffected = fileLocalSections.size
    let filesProcessed = 0

    for (const af of task.data.audioFiles) {
      const localSections = fileLocalSections.get(af.index)
      if (!localSections) continue

      const fileRelativeWeight = 1 / totalFilesAffected

      SocketAuthority.adminEmitter('track_started', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })

      try {
        await ffmpegHelpers.trimAudioFile(af.path, localSections, af.duration, (progress) => {
          SocketAuthority.adminEmitter('task_progress', {
            libraryItemId: task.data.libraryItemId,
            progress: cumulativeProgress + progress * fileRelativeWeight
          })
          SocketAuthority.adminEmitter('track_progress', {
            libraryItemId: task.data.libraryItemId,
            ino: af.ino,
            progress
          })
        })
        Logger.info(`[AudioTrimManager] Successfully trimmed audio file "${af.path}"`)
      } catch (err) {
        Logger.error(`[AudioTrimManager] Failed to trim audio file "${af.path}"`, err)
        task.setFailed({ text: `Failed to trim audio file "${Path.basename(af.path)}"`, key: 'MessageTaskFailedToTrimAudioFile', subs: [Path.basename(af.path)] })
        this.handleTaskFinished(task)
        return
      }

      SocketAuthority.adminEmitter('track_finished', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })

      filesProcessed++
      cumulativeProgress = (filesProcessed / totalFilesAffected) * 100
    }

    // Rescan the library item to pick up new durations
    try {
      await LibraryItemScanner.scanLibraryItem(task.data.libraryItemId)
      Logger.info(`[AudioTrimManager] Rescanned library item ${task.data.libraryItemId}`)
    } catch (err) {
      Logger.error(`[AudioTrimManager] Failed to rescan library item ${task.data.libraryItemId}`, err)

      try {
        const expandedItem = await Database.libraryItemModel.getExpandedById(task.data.libraryItemId)
        if (expandedItem) {
          SocketAuthority.libraryItemEmitter('item_updated', expandedItem)
          Logger.info(`[AudioTrimManager] Manually emitted item_updated for ${task.data.libraryItemId}`)
        }
      } catch (emitErr) {
        Logger.error(`[AudioTrimManager] Failed to emit item_updated for ${task.data.libraryItemId}`, emitErr)
      }
    }

    task.setFinished()
    this.handleTaskFinished(task)
  }
}

module.exports = AudioTrimManager
