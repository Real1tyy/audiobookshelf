const Ffmpeg = require('fluent-ffmpeg')
const ffmpgegUtils = require('fluent-ffmpeg/lib/utils')
const fs = require('fs-extra')
const Path = require('path')
const Logger = require('../Logger')
const { filePathToPOSIX, copyToExisting } = require('./fileUtils')

function escapeSingleQuotes(path) {
  // A ' within a quoted string is escaped with '\'' in ffmpeg (see https://www.ffmpeg.org/ffmpeg-utils.html#Quoting-and-escaping)
  return filePathToPOSIX(path).replace(/'/g, "'\\''")
}

// Returns first track start time
// startTime is for streams starting an encode part-way through an audiobook
async function writeConcatFile(tracks, outputPath, startTime = 0) {
  var trackToStartWithIndex = 0
  var firstTrackStartTime = 0

  // Find first track greater than startTime
  if (startTime > 0) {
    var currTrackEnd = 0
    var startingTrack = tracks.find((t) => {
      currTrackEnd += t.duration
      return startTime < currTrackEnd
    })
    if (startingTrack) {
      firstTrackStartTime = currTrackEnd - startingTrack.duration
      trackToStartWithIndex = startingTrack.index
    }
  }

  var tracksToInclude = tracks.filter((t) => t.index >= trackToStartWithIndex)
  var trackPaths = tracksToInclude.map((t) => {
    var line = "file '" + escapeSingleQuotes(t.metadata.path) + "'\n" + `duration ${t.duration}`
    return line
  })
  var inputstr = trackPaths.join('\n\n')

  try {
    await fs.writeFile(outputPath, inputstr)
    return firstTrackStartTime
  } catch (error) {
    Logger.error(`[ffmpegHelpers] Failed to write stream concat file at "${outputPath}"`, error)
    return null
  }
}
module.exports.writeConcatFile = writeConcatFile

async function extractCoverArt(filepath, outputpath) {
  var dirname = Path.dirname(outputpath)
  await fs.ensureDir(dirname)

  return new Promise((resolve) => {
    /** @type {import('fluent-ffmpeg').FfmpegCommand} */
    var ffmpeg = Ffmpeg(filepath)
    ffmpeg.addOption(['-map 0:v:0', '-frames:v 1'])
    ffmpeg.output(outputpath)

    ffmpeg.on('start', (cmd) => {
      Logger.debug(`[FfmpegHelpers] Extract Cover Cmd: ${cmd}`)
    })
    ffmpeg.on('error', (err, stdout, stderr) => {
      Logger.error(`[FfmpegHelpers] Extract Cover Error ${err}`)
      resolve(false)
    })
    ffmpeg.on('end', () => {
      Logger.debug(`[FfmpegHelpers] Cover Art Extracted Successfully`)
      resolve(outputpath)
    })
    ffmpeg.run()
  })
}
module.exports.extractCoverArt = extractCoverArt

//This should convert based on the output file extension as well
async function resizeImage(filePath, outputPath, width, height) {
  return new Promise((resolve) => {
    /** @type {import('fluent-ffmpeg').FfmpegCommand} */
    var ffmpeg = Ffmpeg(filePath)
    ffmpeg.addOption(['-vf', `scale=${width || -1}:${height || -1}`])
    ffmpeg.addOutput(outputPath)
    ffmpeg.on('start', (cmd) => {
      Logger.debug(`[FfmpegHelpers] Resize Image Cmd: ${cmd}`)
    })
    ffmpeg.on('error', (err, stdout, stderr) => {
      Logger.error(`[FfmpegHelpers] Resize Image Error ${err} ${stdout} ${stderr}`)
      resolve(false)
    })
    ffmpeg.on('end', () => {
      Logger.debug(`[FfmpegHelpers] Image resized Successfully`)
      resolve(outputPath)
    })
    ffmpeg.run()
  })
}
module.exports.resizeImage = resizeImage

/**
 * Generates ffmetadata file content from the provided metadata object and chapters array.
 * @param {Object} metadata - The input metadata object.
 * @param {Array|null} chapters - An array of chapter objects.
 * @returns {string} - The ffmetadata file content.
 */
function generateFFMetadata(metadata, chapters) {
  let ffmetadataContent = ';FFMETADATA1\n'

  // Add global metadata
  for (const key in metadata) {
    if (metadata[key]) {
      ffmetadataContent += `${key}=${escapeFFMetadataValue(metadata[key])}\n`
    }
  }

  // Add chapters
  if (chapters) {
    chapters.forEach((chapter) => {
      ffmetadataContent += '\n[CHAPTER]\n'
      ffmetadataContent += `TIMEBASE=1/1000\n`
      ffmetadataContent += `START=${Math.floor(chapter.start * 1000)}\n`
      ffmetadataContent += `END=${Math.floor(chapter.end * 1000)}\n`
      if (chapter.title) {
        ffmetadataContent += `title=${escapeFFMetadataValue(chapter.title)}\n`
      }
    })
  }

  return ffmetadataContent
}

module.exports.generateFFMetadata = generateFFMetadata

/**
 * Writes FFmpeg metadata file with the given metadata and chapters.
 *
 * @param {Object} metadata - The metadata object.
 * @param {Array} chapters - The array of chapter objects.
 * @param {string} ffmetadataPath - The path to the FFmpeg metadata file.
 * @returns {Promise<boolean>} - A promise that resolves to true if the file was written successfully, false otherwise.
 */
async function writeFFMetadataFile(metadata, chapters, ffmetadataPath) {
  try {
    await fs.writeFile(ffmetadataPath, generateFFMetadata(metadata, chapters))
    Logger.debug(`[ffmpegHelpers] Wrote ${ffmetadataPath}`)
    return true
  } catch (error) {
    Logger.error(`[ffmpegHelpers] Write ${ffmetadataPath} failed`, error)
    return false
  }
}

module.exports.writeFFMetadataFile = writeFFMetadataFile

/**
 * Adds an ffmetadata and optionally a cover image to an audio file using fluent-ffmpeg.
 *
 * @param {string} audioFilePath - Path to the input audio file.
 * @param {string|null} coverFilePath - Path to the cover image file.
 * @param {string} metadataFilePath - Path to the ffmetadata file.
 * @param {number} track - The track number to embed in the audio file.
 * @param {string} mimeType - The MIME type of the audio file.
 * @param {function(number): void|null} progressCB - A callback function to report progress.
 * @param {import('fluent-ffmpeg').FfmpegCommand} ffmpeg - The Ffmpeg instance to use (optional). Used for dependency injection in tests.
 * @param {function(string, string): Promise<void>} copyFunc - The function to use for copying files (optional). Used for dependency injection in tests.
 * @returns {Promise<void>} A promise that resolves if the operation is successful, rejects otherwise.
 */
async function addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, progressCB = null, ffmpeg = Ffmpeg(), copyFunc = copyToExisting) {
  const isMp4 = mimeType === 'audio/mp4'
  const isMp3 = mimeType === 'audio/mpeg'

  const audioFileDir = Path.dirname(audioFilePath)
  const audioFileExt = Path.extname(audioFilePath)
  const audioFileBaseName = Path.basename(audioFilePath, audioFileExt)
  const tempFilePath = filePathToPOSIX(Path.join(audioFileDir, `${audioFileBaseName}.tmp${audioFileExt}`))

  return new Promise((resolve, reject) => {
    ffmpeg.input(audioFilePath).input(metadataFilePath).outputOptions([
      '-map 0:a', // map audio stream from input file
      '-map_metadata 1', // map metadata tags from metadata file first
      '-map_metadata 0', // add additional metadata tags from input file
      '-map_chapters 1', // map chapters from metadata file
      '-c copy' // copy streams
    ])

    if (track && !isNaN(track)) {
      ffmpeg.outputOptions(['-metadata track=' + track])
    }

    if (isMp4) {
      ffmpeg.outputOptions([
        '-f mp4' // force output format to mp4
      ])
    } else if (isMp3) {
      ffmpeg.outputOptions([
        '-id3v2_version 3' // set ID3v2 version to 3
      ])
    }

    if (coverFilePath) {
      ffmpeg.input(coverFilePath).outputOptions([
        '-map 2:v', // map video stream from cover image file
        '-disposition:v:0 attached_pic', // set cover image as attached picture
        '-metadata:s:v',
        'title=Cover', // add title metadata to cover image stream
        '-metadata:s:v',
        'comment=Cover' // add comment metadata to cover image stream
      ])
      const ext = Path.extname(coverFilePath).toLowerCase()
      if (ext === '.webp') {
        ffmpeg.outputOptions([
          '-c:v mjpeg' // convert webp images to jpeg
        ])
      }
    } else {
      ffmpeg.outputOptions([
        '-map 0:v?' // retain video stream from input file if exists
      ])
    }

    ffmpeg
      .output(tempFilePath)
      .on('start', (commandLine) => {
        Logger.debug('[ffmpegHelpers] Spawned Ffmpeg with command: ' + commandLine)
      })
      .on('progress', (progress) => {
        if (!progressCB || !progress.percent) return
        Logger.debug(`[ffmpegHelpers] Progress: ${progress.percent}%`)
        progressCB(progress.percent)
      })
      .on('end', async (stdout, stderr) => {
        Logger.debug('[ffmpegHelpers] ffmpeg stdout:', stdout)
        Logger.debug('[ffmpegHelpers] ffmpeg stderr:', stderr)
        Logger.debug('[ffmpegHelpers] Moving temp file to audio file path:', `"${tempFilePath}"`, '->', `"${audioFilePath}"`)
        try {
          await copyFunc(tempFilePath, audioFilePath)
          await fs.remove(tempFilePath)
          resolve()
        } catch (error) {
          Logger.error(`[ffmpegHelpers] Failed to move temp file to audio file path: "${tempFilePath}" -> "${audioFilePath}"`, error)
          reject(error)
        }
      })
      .on('error', (err, stdout, stderr) => {
        if (err.message && err.message.includes('SIGKILL')) {
          Logger.info(`[ffmpegHelpers] addCoverAndMetadataToFile Killed by User`)
          reject(new Error('FFMPEG_CANCELED'))
        } else {
          Logger.error('Error adding cover image and metadata:', err)
          Logger.error('ffmpeg stdout:', stdout)
          Logger.error('ffmpeg stderr:', stderr)
          reject(err)
        }
      })

    ffmpeg.run()
  })
}

module.exports.addCoverAndMetadataToFile = addCoverAndMetadataToFile

function escapeFFMetadataValue(value) {
  return value.replace(/([;=\n\\#])/g, '\\$1')
}

/**
 * Retrieves the FFmpeg metadata object for a given library item.
 *
 * @param {import('../models/LibraryItem')} libraryItem - The library item containing the media metadata.
 * @param {number} audioFilesLength - The length of the audio files.
 * @returns {Object} - The FFmpeg metadata object.
 */
function getFFMetadataObject(libraryItem, audioFilesLength) {
  const ffmetadata = {
    title: libraryItem.media.title,
    artist: libraryItem.media.authorName,
    album_artist: libraryItem.media.authorName,
    album: (libraryItem.media.title || '') + (libraryItem.media.subtitle ? `: ${libraryItem.media.subtitle}` : ''),
    TIT3: libraryItem.media.subtitle, // mp3 only
    genre: libraryItem.media.genres?.join('; '),
    date: libraryItem.media.publishedYear,
    comment: libraryItem.media.description,
    description: libraryItem.media.description,
    copyright: libraryItem.media.publisher,
    publisher: libraryItem.media.publisher, // mp3 only
    TRACKTOTAL: `${audioFilesLength}`, // mp3 only
    grouping: libraryItem.media.series?.map((s) => s.name + (s.bookSeries.sequence ? ` #${s.bookSeries.sequence}` : '')).join('; ')
  }
  Object.keys(ffmetadata).forEach((key) => {
    if (!ffmetadata[key]) {
      delete ffmetadata[key]
    }
  })

  return ffmetadata
}

module.exports.getFFMetadataObject = getFFMetadataObject

/**
 * Merges audio files into a single output file using FFmpeg.
 *
 * @param {import('../models/Book').AudioFileObject} audioTracks - The audio tracks to merge.
 * @param {number} duration - The total duration of the audio tracks.
 * @param {string} itemCachePath - The path to the item cache.
 * @param {string} outputFilePath - The path to the output file.
 * @param {import('../managers/AbMergeManager').AbMergeEncodeOptions} encodingOptions - The options for encoding the audio.
 * @param {Function} [progressCB=null] - The callback function to track the progress of the merge.
 * @param {import('fluent-ffmpeg').FfmpegCommand} [ffmpeg=Ffmpeg()] - The FFmpeg instance to use for merging.
 * @returns {Promise<void>} A promise that resolves when the audio files are merged successfully.
 */
async function mergeAudioFiles(audioTracks, duration, itemCachePath, outputFilePath, encodingOptions, progressCB = null, ffmpeg = Ffmpeg()) {
  const audioBitrate = encodingOptions.bitrate || '128k'
  const audioCodec = encodingOptions.codec || 'aac'
  const audioChannels = encodingOptions.channels || 2

  // TODO: Updated in 2.2.11 to always encode even if merging multiple m4b. This is because just using the file extension as was being done before is not enough. This can be an option or do more to check if a concat is possible.
  // const audioRequiresEncode = audioTracks[0].metadata.ext !== '.m4b'
  const audioRequiresEncode = true

  const firstTrackIsM4b = audioTracks[0].metadata.ext.toLowerCase() === '.m4b'
  const isOneTrack = audioTracks.length === 1

  let concatFilePath = null
  if (!isOneTrack) {
    concatFilePath = Path.join(itemCachePath, 'files.txt')
    if ((await writeConcatFile(audioTracks, concatFilePath)) == null) {
      throw new Error('Failed to write concat file')
    }
    ffmpeg.input(concatFilePath).inputOptions(['-safe 0', '-f concat'])
  } else {
    ffmpeg.input(audioTracks[0].metadata.path).inputOptions(firstTrackIsM4b ? ['-f mp4'] : [])
  }

  //const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'warning'
  ffmpeg.outputOptions(['-f mp4'])

  if (audioRequiresEncode) {
    ffmpeg.outputOptions(['-map 0:a', `-acodec ${audioCodec}`, `-ac ${audioChannels}`, `-b:a ${audioBitrate}`])
  } else {
    ffmpeg.outputOptions(['-max_muxing_queue_size 1000'])

    if (isOneTrack && firstTrackIsM4b) {
      ffmpeg.outputOptions(['-c copy'])
    } else {
      ffmpeg.outputOptions(['-c:a copy'])
    }
  }

  ffmpeg.output(outputFilePath)

  return new Promise((resolve, reject) => {
    ffmpeg
      .on('start', (cmd) => {
        Logger.debug(`[ffmpegHelpers] Merge Audio Files ffmpeg command: ${cmd}`)
      })
      .on('progress', (progress) => {
        if (!progressCB || !progress.timemark || !duration) return
        // Cannot rely on progress.percent as it is not accurate for concat
        const percent = (ffmpgegUtils.timemarkToSeconds(progress.timemark) / duration) * 100
        progressCB(percent)
      })
      .on('end', async (stdout, stderr) => {
        if (concatFilePath) await fs.remove(concatFilePath)
        Logger.debug('[ffmpegHelpers] ffmpeg stdout:', stdout)
        Logger.debug('[ffmpegHelpers] ffmpeg stderr:', stderr)
        Logger.debug(`[ffmpegHelpers] Audio Files Merged Successfully`)
        resolve()
      })
      .on('error', async (err, stdout, stderr) => {
        if (concatFilePath) await fs.remove(concatFilePath)
        if (err.message && err.message.includes('SIGKILL')) {
          Logger.info(`[ffmpegHelpers] Merge Audio Files Killed by User`)
          reject(new Error('FFMPEG_CANCELED'))
        } else {
          Logger.error(`[ffmpegHelpers] Merge Audio Files Error ${err}`)
          Logger.error('ffmpeg stdout:', stdout)
          Logger.error('ffmpeg stderr:', stderr)
          reject(err)
        }
      })

    ffmpeg.run()
  })
}

module.exports.mergeAudioFiles = mergeAudioFiles

/**
 * Convert sections-to-remove into sections-to-keep.
 * @param {Array<{start: number, end: number}>} removeSections - sorted, non-overlapping sections to remove
 * @param {number} totalDuration - total file duration in seconds
 * @returns {Array<{start: number, end: number}>}
 */
function computeKeepSegments(removeSections, totalDuration) {
  const sorted = [...removeSections].sort((a, b) => a.start - b.start)
  const keeps = []
  let cursor = 0

  for (const section of sorted) {
    if (section.start > cursor) {
      keeps.push({ start: cursor, end: section.start })
    }
    cursor = Math.max(cursor, section.end)
  }

  if (cursor < totalDuration) {
    keeps.push({ start: cursor, end: totalDuration })
  }

  return keeps
}

/**
 * Trims an audio file by removing specified time sections.
 * Uses atrim filters with concat to produce the output reliably.
 *
 * @param {string} audioFilePath - Path to the input audio file.
 * @param {Array<{start: number, end: number}>} sections - Time sections to remove (in seconds, file-local).
 * @param {number} duration - Total duration of the audio file in seconds.
 * @param {function(number): void|null} progressCB - Progress callback (0-100).
 * @returns {Promise<void>}
 */
async function trimAudioFile(audioFilePath, sections, duration, progressCB = null) {
  const audioFileDir = Path.dirname(audioFilePath)
  const audioFileExt = Path.extname(audioFilePath)
  const audioFileBaseName = Path.basename(audioFilePath, audioFileExt)
  const tempFilePath = filePathToPOSIX(Path.join(audioFileDir, `${audioFileBaseName}.tmp${audioFileExt}`))

  const keepSegments = computeKeepSegments(sections, duration)

  if (keepSegments.length === 0) {
    throw new Error('Nothing would remain after trimming')
  }

  // Build a complex filter graph: for each keep segment, atrim + asetpts, then concat
  const filterParts = []
  const concatInputs = []
  for (let i = 0; i < keepSegments.length; i++) {
    const seg = keepSegments[i]
    filterParts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[seg${i}]`)
    concatInputs.push(`[seg${i}]`)
  }
  filterParts.push(`${concatInputs.join('')}concat=n=${keepSegments.length}:v=0:a=1[outa]`)
  const filterGraph = filterParts.join(';')

  Logger.debug(`[ffmpegHelpers] trimAudioFile keep segments: ${JSON.stringify(keepSegments)}`)
  Logger.debug(`[ffmpegHelpers] trimAudioFile filter_complex: ${filterGraph}`)

  const ffmpeg = Ffmpeg()

  return new Promise((resolve, reject) => {
    ffmpeg
      .input(audioFilePath)
      .outputOptions(['-filter_complex', filterGraph, '-map', '[outa]'])
      .output(tempFilePath)
      .on('start', (commandLine) => {
        Logger.info('[ffmpegHelpers] trimAudioFile command: ' + commandLine)
      })
      .on('progress', (progress) => {
        if (!progressCB) return
        if (progress.timemark && duration) {
          const percent = Math.min(100, (ffmpgegUtils.timemarkToSeconds(progress.timemark) / duration) * 100)
          progressCB(percent)
        } else if (progress.percent) {
          progressCB(progress.percent)
        }
      })
      .on('end', async () => {
        try {
          // Replace original with trimmed version
          await fs.move(tempFilePath, audioFilePath, { overwrite: true })
          Logger.info(`[ffmpegHelpers] trimAudioFile: replaced original with trimmed file`)
          resolve()
        } catch (error) {
          Logger.error(`[ffmpegHelpers] Failed to replace original file: "${tempFilePath}" -> "${audioFilePath}"`, error)
          reject(error)
        }
      })
      .on('error', (err, stdout, stderr) => {
        if (err.message && err.message.includes('SIGKILL')) {
          Logger.info('[ffmpegHelpers] trimAudioFile killed by user')
          reject(new Error('FFMPEG_CANCELED'))
        } else {
          Logger.error('[ffmpegHelpers] trimAudioFile error:', err)
          Logger.error('ffmpeg stdout:', stdout)
          Logger.error('ffmpeg stderr:', stderr)
          reject(err)
        }
      })

    ffmpeg.run()
  })
}

module.exports.trimAudioFile = trimAudioFile

/**
 * Extracts a section of audio from an input file and writes it to a new output file.
 * Uses atrim filter to keep only the specified time range.
 *
 * @param {string} inputPath - Path to the input audio file.
 * @param {number} startTime - Start time in seconds.
 * @param {number} endTime - End time in seconds.
 * @param {string} outputPath - Path to write the extracted audio.
 * @param {function(number): void|null} progressCB - Progress callback (0-100).
 * @returns {Promise<void>}
 */
async function extractAudioSection(inputPath, startTime, endTime, outputPath, progressCB = null) {
  const duration = endTime - startTime
  const filterGraph = `[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[outa]`

  Logger.debug(`[ffmpegHelpers] extractAudioSection: ${startTime}s to ${endTime}s from "${inputPath}" -> "${outputPath}"`)
  Logger.debug(`[ffmpegHelpers] extractAudioSection filter_complex: ${filterGraph}`)

  const ffmpeg = Ffmpeg()

  return new Promise((resolve, reject) => {
    ffmpeg
      .input(inputPath)
      .outputOptions(['-filter_complex', filterGraph, '-map', '[outa]'])
      .output(outputPath)
      .on('start', (commandLine) => {
        Logger.info('[ffmpegHelpers] extractAudioSection command: ' + commandLine)
      })
      .on('progress', (progress) => {
        if (!progressCB) return
        if (progress.timemark && duration) {
          const percent = Math.min(100, (ffmpgegUtils.timemarkToSeconds(progress.timemark) / duration) * 100)
          progressCB(percent)
        } else if (progress.percent) {
          progressCB(progress.percent)
        }
      })
      .on('end', () => {
        Logger.info(`[ffmpegHelpers] extractAudioSection: complete`)
        resolve()
      })
      .on('error', (err, stdout, stderr) => {
        if (err.message && err.message.includes('SIGKILL')) {
          Logger.info('[ffmpegHelpers] extractAudioSection killed by user')
          reject(new Error('FFMPEG_CANCELED'))
        } else {
          Logger.error('[ffmpegHelpers] extractAudioSection error:', err)
          Logger.error('ffmpeg stdout:', stdout)
          Logger.error('ffmpeg stderr:', stderr)
          reject(err)
        }
      })

    ffmpeg.run()
  })
}

module.exports.extractAudioSection = extractAudioSection
