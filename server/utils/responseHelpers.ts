import type { Response } from 'express'
import Path from 'path'
const Logger = require('../Logger')
const { encodeUriPath, getAudioMimeTypeFromExtname } = require('./fileUtils')
const { AudioMimeType } = require('./constants')

/**
 * Serve a static file via X-Accel-Redirect if enabled, otherwise return false.
 */
function sendXAccel(res: Response, absPath: string): boolean {
  if (!(global as any).XAccel) return false
  const encodedURI = encodeUriPath((global as any).XAccel + absPath)
  Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
  res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
  return true
}

interface UserAgent {
  device: { vendor?: string; type?: string }
  engine: { name?: string }
}

/**
 * Set the Content-Type header for audio files.
 */
function setAudioContentType(res: Response, filePath: string, ua?: UserAgent): void {
  let audioMimeType = getAudioMimeTypeFromExtname(Path.extname(filePath))
  if (!audioMimeType) return

  if (ua) {
    const isAppleMobileBrowser = ua.device.vendor === 'Apple' && ua.device.type === 'mobile' && ua.engine.name === 'WebKit'
    if (isAppleMobileBrowser && audioMimeType === AudioMimeType.M4B) {
      audioMimeType = 'audio/m4b'
    }
  }

  res.setHeader('Content-Type', audioMimeType)
}

/**
 * Promisified res.download().
 */
function resDownload(res: Response, absPath: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    res.download(absPath, filename, (error) => (error ? reject(error) : resolve()))
  })
}

/**
 * Promisified res.sendFile().
 */
function resSendFile(res: Response, absPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    res.sendFile(absPath, (error) => (error ? reject(error) : resolve()))
  })
}

/**
 * Handle download errors consistently.
 */
function handleDownloadError(error: NodeJS.ErrnoException, res: Response): void {
  if (!res.headersSent) {
    if (error.code === 'ENOENT') {
      res.status(404).send('File not found')
    } else {
      res.status(500).send('Download failed')
    }
  }
}

module.exports = { sendXAccel, setAudioContentType, resDownload, resSendFile, handleDownloadError }
