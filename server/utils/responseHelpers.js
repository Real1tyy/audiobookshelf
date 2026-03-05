const Path = require('path')
const Logger = require('../Logger')
const { encodeUriPath, getAudioMimeTypeFromExtname } = require('./fileUtils')
const { AudioMimeType } = require('./constants')

/**
 * Serve a static file via X-Accel-Redirect if enabled, otherwise return false.
 * Replaces 9 identical X-Accel blocks across controllers.
 *
 * @param {import('express').Response} res
 * @param {string} absPath - absolute file path to serve
 * @returns {boolean} true if X-Accel handled the response
 */
function sendXAccel(res, absPath) {
  if (!global.XAccel) return false
  const encodedURI = encodeUriPath(global.XAccel + absPath)
  Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
  res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
  return true
}

/**
 * Set the Content-Type header for audio files.
 * Handles the m4b mimetype workaround for Express and Apple mobile browsers.
 *
 * @param {import('express').Response} res
 * @param {string} filePath - file path (used to extract extension)
 * @param {object} [ua] - parsed user-agent object from ua-parser-js (optional)
 */
function setAudioContentType(res, filePath, ua) {
  let audioMimeType = getAudioMimeTypeFromExtname(Path.extname(filePath))
  if (!audioMimeType) return

  if (ua) {
    // Work-around for Apple devices mishandling Content-Type on mobile browsers:
    // https://github.com/advplyr/audiobookshelf/issues/3310
    const isAppleMobileBrowser = ua.device.vendor === 'Apple' && ua.device.type === 'mobile' && ua.engine.name === 'WebKit'
    if (isAppleMobileBrowser && audioMimeType === AudioMimeType.M4B) {
      audioMimeType = 'audio/m4b'
    }
  }

  res.setHeader('Content-Type', audioMimeType)
}

/**
 * Promisified res.download().
 *
 * @param {import('express').Response} res
 * @param {string} absPath - absolute path to the file
 * @param {string} filename - filename for the Content-Disposition header
 * @returns {Promise<void>}
 */
function resDownload(res, absPath, filename) {
  return new Promise((resolve, reject) => {
    res.download(absPath, filename, (error) => (error ? reject(error) : resolve()))
  })
}

/**
 * Promisified res.sendFile().
 *
 * @param {import('express').Response} res
 * @param {string} absPath - absolute path to the file
 * @returns {Promise<void>}
 */
function resSendFile(res, absPath) {
  return new Promise((resolve, reject) => {
    res.sendFile(absPath, (error) => (error ? reject(error) : resolve()))
  })
}

/**
 * Handle download errors consistently.
 * Only sends a response if headers haven't been sent yet.
 *
 * @param {Error} error
 * @param {import('express').Response} res
 */
function handleDownloadError(error, res) {
  if (!res.headersSent) {
    if (error.code === 'ENOENT') {
      return res.status(404).send('File not found')
    } else {
      return res.status(500).send('Download failed')
    }
  }
}

module.exports = { sendXAccel, setAudioContentType, resDownload, resSendFile, handleDownloadError }
