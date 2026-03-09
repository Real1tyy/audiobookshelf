const Path = require('path')
const { Response } = require('express')
const Logger = require('../Logger')
const archiver = require('archiver')

/**
 * Create and configure an archiver instance piped to the response.
 *
 * @param {string} filename
 * @param {Response} res
 * @returns {{ archive: archiver.Archiver, promise: Promise<void> }}
 */
function createArchivePipe(filename, res) {
  res.attachment(filename)

  const archive = archiver('zip', {
    zlib: { level: 0 }
  })

  const promise = new Promise((resolve, reject) => {
    res.on('close', () => {
      Logger.info(archive.pointer() + ' total bytes')
      Logger.debug('archiver has been finalized and the output file descriptor has closed.')
      resolve()
    })

    res.on('end', () => {
      Logger.debug('Data has been drained')
    })

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        Logger.warn(`[DownloadManager] Archiver warning: ${err.message}`)
      } else {
        Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
        reject(err)
      }
    })

    archive.on('error', (err) => {
      Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
      reject(err)
    })
  })

  archive.pipe(res)

  return { archive, promise }
}

/**
 * @param {string} path
 * @param {string} filename
 * @param {Response} res
 * @returns {Promise<void>}
 */
module.exports.zipDirectoryPipe = (path, filename, res) => {
  const { archive, promise } = createArchivePipe(filename, res)
  archive.directory(path, false)
  archive.finalize()
  return promise
}

/**
 * Creates a zip archive containing multiple directories and streams it to the response.
 *
 * @param {{ path: string, isFile: boolean }[]} pathObjects
 * @param {string} filename
 * @param {Response} res
 * @returns {Promise<void>}
 */
module.exports.zipDirectoriesPipe = (pathObjects, filename, res) => {
  const { archive, promise } = createArchivePipe(filename, res)

  pathObjects.forEach((pathObject) => {
    if (!pathObject.isFile) {
      archive.directory(pathObject.path, Path.basename(pathObject.path))
    } else {
      archive.file(pathObject.path, { name: Path.basename(pathObject.path) })
    }
  })

  archive.finalize()
  return promise
}
