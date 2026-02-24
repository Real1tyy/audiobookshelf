const Path = require('path')
const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const ffmpegHelpers = require('../utils/ffmpegHelpers')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')
const fileUtils = require('../utils/fileUtils')
const Database = require('../Database')
const LibraryItemScanner = require('../scanner/LibraryItemScanner')

class AudioExtractManager {
  constructor() {
    this.MAX_CONCURRENT_TASKS = 1
    this.tasksRunning = []
    this.tasksQueued = []
  }

  getIsLibraryItemQueuedOrProcessing(libraryItemId) {
    return this.tasksQueued.some((t) => t.data.libraryItemId === libraryItemId) || this.tasksRunning.some((t) => t.data.libraryItemId === libraryItemId)
  }

  /**
   * Map global timeline range to per-file local ranges.
   * Returns only files that overlap with [startTime, endTime].
   *
   * @param {number} startTime - Global start time in seconds
   * @param {number} endTime - Global end time in seconds
   * @param {Array<{index: number, duration: number, path: string, ino: string, filename: string}>} audioFiles
   * @returns {Array<{fileIndex: number, path: string, localStart: number, localEnd: number, duration: number}>}
   */
  mapExtractRangeToFiles(startTime, endTime, audioFiles) {
    const segments = []
    let cumulativeOffset = 0

    for (const af of audioFiles) {
      const fileStart = cumulativeOffset
      const fileEnd = cumulativeOffset + af.duration

      if (startTime < fileEnd && endTime > fileStart) {
        const localStart = Math.max(0, startTime - fileStart)
        const localEnd = Math.min(af.duration, endTime - fileStart)
        if (localEnd > localStart) {
          segments.push({
            fileIndex: af.index,
            path: af.path,
            localStart,
            localEnd,
            duration: af.duration
          })
        }
      }

      cumulativeOffset += af.duration
    }

    return segments
  }

  /**
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {number} startTime
   * @param {number} endTime
   * @param {string} title
   */
  async extractHighlightForItem(userId, libraryItem, startTime, endTime, title) {
    const audioFiles = libraryItem.media.includedAudioFiles

    const task = new Task()
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryId: libraryItem.libraryId,
      userId,
      audioFiles: audioFiles.map((af) => ({
        index: af.index,
        ino: af.ino,
        filename: af.metadata.filename,
        path: af.metadata.path,
        duration: af.duration
      })),
      startTime,
      endTime,
      title,
      duration: libraryItem.media.duration,
      sourceTitle: libraryItem.media.title,
      sourceAuthorName: libraryItem.media.authorName || '',
      sourceTags: libraryItem.media.tags || [],
      sourceDescription: libraryItem.media.description || ''
    }

    const taskTitleString = {
      text: 'Extracting Highlight',
      key: 'MessageTaskExtractingHighlight'
    }
    const taskDescriptionString = {
      text: `Extracting highlight "${title}" from "${libraryItem.media.title}".`,
      key: 'MessageTaskExtractingHighlightDescription',
      subs: [title, libraryItem.media.title]
    }
    task.setData('extract-highlight', taskTitleString, taskDescriptionString, false, taskData)

    if (this.tasksRunning.length >= this.MAX_CONCURRENT_TASKS) {
      Logger.info(`[AudioExtractManager] Queueing extract for "${title}"`)
      this.tasksQueued.push(task)
    } else {
      this.runExtractTask(task)
    }
  }

  /**
   * @param {import('../objects/Task')} task
   */
  async runExtractTask(task) {
    this.tasksRunning.push(task)
    TaskManager.addTask(task)

    const { startTime, endTime, title, audioFiles, libraryItemId, libraryId } = task.data

    Logger.info(`[AudioExtractManager] Starting extract task: "${title}" (${startTime}s - ${endTime}s)`)

    // Determine output directory — create a new folder in the same parent as the source item
    const sourceItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
    if (!sourceItem) {
      Logger.error(`[AudioExtractManager] Source library item not found: ${libraryItemId}`)
      task.setFailed({ text: 'Source library item not found', key: 'MessageTaskSourceItemNotFound' })
      this.handleTaskFinished(task)
      return
    }

    // For physical items, create alongside the source. For virtual items, use metadata cache.
    let outputDir
    let outputFilePath
    const sanitizedTitle = fileUtils.sanitizeFilename(title)

    if (sourceItem.path) {
      // Physical item — create a sibling folder
      const parentDir = Path.dirname(sourceItem.path)
      outputDir = Path.join(parentDir, sanitizedTitle)
    } else {
      // Virtual item — use metadata cache
      outputDir = Path.join(global.MetadataPath, 'cache', 'highlights', sanitizedTitle)
    }

    outputFilePath = Path.join(outputDir, `${sanitizedTitle}.mp3`)

    // Ensure output directory exists
    try {
      await fs.ensureDir(outputDir)
    } catch (err) {
      Logger.error(`[AudioExtractManager] Failed to create output directory: ${outputDir}`, err)
      task.setFailed({ text: 'Failed to create output directory', key: 'MessageTaskFailedCreateOutputDir' })
      this.handleTaskFinished(task)
      return
    }

    // Check output dir is writable
    const outputDirWritable = await fileUtils.isWritable(outputDir)
    if (!outputDirWritable) {
      Logger.error(`[AudioExtractManager] Output directory is not writable: ${outputDir}`)
      task.setFailed({ text: 'Output directory is not writable', key: 'MessageTaskTargetDirectoryNotWritable' })
      this.handleTaskFinished(task)
      return
    }

    // Map the extract range to individual files
    const segments = this.mapExtractRangeToFiles(startTime, endTime, audioFiles)

    if (segments.length === 0) {
      Logger.warn(`[AudioExtractManager] No audio files overlap with the specified range`)
      task.setFailed({ text: 'No audio files overlap with the specified time range', key: 'MessageTaskNoOverlappingSections' })
      this.handleTaskFinished(task)
      return
    }

    try {
      if (segments.length === 1) {
        // Single file — extract directly
        const seg = segments[0]
        await ffmpegHelpers.extractAudioSection(seg.path, seg.localStart, seg.localEnd, outputFilePath, (progress) => {
          SocketAuthority.adminEmitter('task_progress', {
            libraryItemId,
            progress
          })
        })
      } else {
        // Multiple files — extract each segment to temp, then concat
        const tempFiles = []
        const totalSegments = segments.length

        for (let i = 0; i < totalSegments; i++) {
          const seg = segments[i]
          const tempPath = Path.join(outputDir, `_temp_seg_${i}.mp3`)
          tempFiles.push(tempPath)

          const segWeight = 1 / totalSegments
          await ffmpegHelpers.extractAudioSection(seg.path, seg.localStart, seg.localEnd, tempPath, (progress) => {
            const overallProgress = ((i / totalSegments) + (progress / 100) * segWeight) * 100
            SocketAuthority.adminEmitter('task_progress', {
              libraryItemId,
              progress: overallProgress
            })
          })
        }

        // Concat temp files into final output
        const concatFilePath = Path.join(outputDir, '_concat.txt')
        const concatContent = tempFiles.map((f) => `file '${fileUtils.filePathToPOSIX(f).replace(/'/g, "'\\''")}'`).join('\n')
        await fs.writeFile(concatFilePath, concatContent)

        await new Promise((resolve, reject) => {
          const Ffmpeg = require('../libs/fluentFfmpeg')
          const ffmpeg = Ffmpeg()
          ffmpeg
            .input(concatFilePath)
            .inputOptions(['-safe 0', '-f concat'])
            .outputOptions(['-c copy'])
            .output(outputFilePath)
            .on('start', (cmd) => Logger.debug(`[AudioExtractManager] Concat command: ${cmd}`))
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
          ffmpeg.run()
        })

        // Clean up temp files
        for (const tempFile of tempFiles) {
          await fs.remove(tempFile).catch(() => {})
        }
        await fs.remove(concatFilePath).catch(() => {})
      }

      Logger.info(`[AudioExtractManager] Audio extraction complete: ${outputFilePath}`)
    } catch (err) {
      Logger.error(`[AudioExtractManager] Failed to extract audio`, err)
      task.setFailed({ text: 'Failed to extract audio', key: 'MessageTaskFailedExtractAudio' })
      // Clean up partial output
      await fs.remove(outputDir).catch(() => {})
      this.handleTaskFinished(task)
      return
    }

    // Let the library scanner discover the new folder as a proper library item
    // This ensures audio files, duration, and all metadata are populated correctly
    try {
      const sourceAuthorName = task.data.sourceAuthorName
      const sourceTags = task.data.sourceTags
      const sourceDescription = task.data.sourceDescription
      const sourceBookId = sourceItem.media.id

      // Find the library and its folders for scanning
      const library = await Database.libraryModel.findByPk(libraryId, {
        include: Database.libraryFolderModel
      })

      if (!library || !library.libraryFolders?.length) {
        throw new Error(`Library or folder not found for library ${libraryId}`)
      }

      // Find the folder that contains the output directory
      const outputDirPosix = fileUtils.filePathToPOSIX(outputDir)
      let folder = library.libraryFolders.find((f) => outputDirPosix.startsWith(fileUtils.filePathToPOSIX(f.path)))
      if (!folder) {
        // Fallback to the source item's folder or first folder
        folder = library.libraryFolders.find((f) => f.id === sourceItem.libraryFolderId) || library.libraryFolders[0]
      }

      // Use scanPotentialNewLibraryItem to properly discover and create the item
      const newLibraryItem = await LibraryItemScanner.scanPotentialNewLibraryItem(outputDir, library, folder, false)

      if (!newLibraryItem) {
        throw new Error('Scanner did not create a library item from the extracted audio')
      }

      Logger.info(`[AudioExtractManager] Scanner created highlight item ${newLibraryItem.id}`)

      // Now update the scanned item's metadata with source info
      const expandedItem = await Database.libraryItemModel.getExpandedById(newLibraryItem.id)
      if (expandedItem) {
        const media = expandedItem.media

        // Update description and metadata on the book
        const descPrefix = `Highlight from "${task.data.sourceTitle}"`
        media.description = sourceDescription ? `${descPrefix}. ${sourceDescription}` : descPrefix
        media.tags = sourceTags || []
        media.relatedBooks = [sourceBookId]
        media.changed('description', true)
        media.changed('tags', true)
        media.changed('relatedBooks', true)
        await media.save()

        // Set extraData on the library item (not the book)
        expandedItem.extraData = { highlightOf: libraryItemId, startTime, endTime }
        expandedItem.changed('extraData', true)
        await expandedItem.save()

        // Link author if present
        if (sourceAuthorName) {
          const author = await Database.authorModel.findOrCreateByNameAndLibrary(sourceAuthorName.trim(), libraryId)
          const existingAuthors = await Database.bookAuthorModel.findAll({ where: { bookId: media.id } })
          if (!existingAuthors.some((ba) => ba.authorId === author.id)) {
            await Database.bookAuthorModel.create({ bookId: media.id, authorId: author.id })
          }
          Database.addAuthorToFilterData(libraryId, author.name, author.id)
        }

        if (sourceTags?.length) {
          Database.addTagsToFilterData(libraryId, sourceTags)
        }

        // Add bidirectional relatedBooks link on the source item (uses book/media IDs)
        const sourceBook = sourceItem.media
        const sourceRelated = sourceBook.relatedBooks || []
        if (!sourceRelated.includes(media.id)) {
          sourceBook.relatedBooks = [...sourceRelated, media.id]
          sourceBook.changed('relatedBooks', true)
          await sourceBook.save()
        }

        // Re-fetch and emit item_added so client picks it up
        const finalItem = await Database.libraryItemModel.getExpandedById(newLibraryItem.id)
        if (finalItem) {
          SocketAuthority.libraryItemEmitter('item_added', finalItem)
        }
      }

      Logger.info(`[AudioExtractManager] Created highlight library item "${title}" (${newLibraryItem.id})`)
    } catch (err) {
      Logger.error(`[AudioExtractManager] Failed to create highlight library item`, err)
      task.setFailed({ text: 'Audio extracted but failed to create library item', key: 'MessageTaskFailedCreateHighlightItem' })
      this.handleTaskFinished(task)
      return
    }

    task.setFinished()
    this.handleTaskFinished(task)
  }

  handleTaskFinished(task) {
    TaskManager.taskFinished(task)
    this.tasksRunning = this.tasksRunning.filter((t) => t.id !== task.id)

    if (this.tasksRunning.length < this.MAX_CONCURRENT_TASKS && this.tasksQueued.length) {
      Logger.info(`[AudioExtractManager] Task finished, dequeueing next task. ${this.tasksQueued.length} tasks queued.`)
      const nextTask = this.tasksQueued.shift()
      this.runExtractTask(nextTask)
    }
  }
}

module.exports = AudioExtractManager
