import Path from 'path'
import { z } from 'zod'
import { createZodClass } from '../zodHelpers'
const packageJson = require('../../../package.json')
const { BookshelfView } = require('../../utils/constants')
const Logger = require('../../Logger')
const User = require('../../models/User')

const ServerSettingsSchema = z.object({
  id: z.string().default('server-settings'),
  tokenSecret: z.string().nullable().default(null),

  // Scanner
  scannerParseSubtitle: z.boolean().default(false),
  scannerFindCovers: z.boolean().default(false),
  scannerCoverProvider: z.string().default('google'),
  scannerPreferMatchedMetadata: z.boolean().default(false),
  scannerDisableWatcher: z.boolean().default(false),

  // Metadata
  storeCoverWithItem: z.boolean().default(false),
  storeMetadataWithItem: z.boolean().default(false),
  metadataFileFormat: z.string().default('json'),

  // Security
  rateLimitLoginRequests: z.number().default(10),
  rateLimitLoginWindow: z.number().default(10 * 60 * 1000),
  allowIframe: z.boolean().default(false),

  // Backups
  backupPath: z.string().default(''),
  backupSchedule: z.union([z.string(), z.boolean()]).default(false),
  backupsToKeep: z.number().default(2),
  maxBackupSize: z.number().default(1),

  // Logger
  loggerDailyLogsToKeep: z.number().default(7),
  loggerScannerLogsToKeep: z.number().default(2),

  // Bookshelf
  homeBookshelfView: z.number().default(BookshelfView.DETAIL),
  bookshelfView: z.number().default(BookshelfView.DETAIL),

  // Sorting
  sortingIgnorePrefix: z.boolean().default(false),
  sortingPrefixes: z.array(z.string()).default(['the', 'a']),

  // Misc
  dateFormat: z.string().default('MM/dd/yyyy'),
  timeFormat: z.string().default('HH:mm'),
  language: z.string().default('en-us'),
  allowedOrigins: z.array(z.string()).default([]),
  logLevel: z.number().default(0),
  version: z.string().nullable().default(null),
  buildNumber: z.number().default(0),

  // Auth
  authLoginCustomMessage: z.string().nullable().default(null),
  authActiveAuthMethods: z.array(z.string()).default(['local']),

  // OpenID
  authOpenIDIssuerURL: z.string().nullable().default(null),
  authOpenIDAuthorizationURL: z.string().nullable().default(null),
  authOpenIDTokenURL: z.string().nullable().default(null),
  authOpenIDUserInfoURL: z.string().nullable().default(null),
  authOpenIDJwksURL: z.string().nullable().default(null),
  authOpenIDLogoutURL: z.string().nullable().default(null),
  authOpenIDClientID: z.string().nullable().default(null),
  authOpenIDClientSecret: z.string().nullable().default(null),
  authOpenIDTokenSigningAlgorithm: z.string().default('RS256'),
  authOpenIDButtonText: z.string().default('Login with OpenId'),
  authOpenIDAutoLaunch: z.boolean().default(false),
  authOpenIDAutoRegister: z.boolean().default(false),
  authOpenIDMatchExistingBy: z.string().nullable().default(null),
  authOpenIDMobileRedirectURIs: z.array(z.string()).default(['audiobookshelf://oauth']),
  authOpenIDGroupClaim: z.string().default(''),
  authOpenIDAdvancedPermsClaim: z.string().default(''),
  authOpenIDSubfolderForRedirectURLs: z.string().optional()
})

class ServerSettings extends createZodClass(ServerSettingsSchema) {
  constructor(settings?: any) {
    super(settings)

    if (!settings) {
      // Defaults that depend on globals
      this.backupPath = Path.join(global.MetadataPath, 'backups')
      this.logLevel = Logger.logLevel
      this.version = packageJson.version
      this.buildNumber = packageJson.buildNumber
      return
    }

    // Apply coercions matching original behavior
    this.scannerFindCovers = !!settings.scannerFindCovers
    this.scannerCoverProvider = settings.scannerCoverProvider || 'google'
    this.scannerPreferMatchedMetadata = !!settings.scannerPreferMatchedMetadata
    this.scannerDisableWatcher = !!settings.scannerDisableWatcher
    this.storeCoverWithItem = !!settings.storeCoverWithItem
    this.storeMetadataWithItem = !!settings.storeMetadataWithItem
    this.metadataFileFormat = settings.metadataFileFormat || 'json'
    this.rateLimitLoginRequests = !isNaN(settings.rateLimitLoginRequests) ? Number(settings.rateLimitLoginRequests) : 10
    this.rateLimitLoginWindow = !isNaN(settings.rateLimitLoginWindow) ? Number(settings.rateLimitLoginWindow) : 10 * 60 * 1000
    this.allowIframe = !!settings.allowIframe
    this.backupPath = settings.backupPath || Path.join(global.MetadataPath, 'backups')
    this.backupSchedule = settings.backupSchedule || false
    this.backupsToKeep = settings.backupsToKeep || 2
    this.maxBackupSize = settings.maxBackupSize === 0 ? 0 : settings.maxBackupSize || 1
    this.loggerDailyLogsToKeep = settings.loggerDailyLogsToKeep || 7
    this.loggerScannerLogsToKeep = settings.loggerScannerLogsToKeep || 2
    this.homeBookshelfView = settings.homeBookshelfView || BookshelfView.STANDARD
    this.bookshelfView = settings.bookshelfView || BookshelfView.STANDARD
    this.sortingIgnorePrefix = !!settings.sortingIgnorePrefix
    this.sortingPrefixes = settings.sortingPrefixes || ['the']
    this.dateFormat = settings.dateFormat || 'MM/dd/yyyy'
    this.timeFormat = settings.timeFormat || 'HH:mm'
    this.language = settings.language || 'en-us'
    this.allowedOrigins = settings.allowedOrigins || []
    this.logLevel = settings.logLevel || Logger.logLevel
    this.version = settings.version || null
    this.buildNumber = settings.buildNumber || 0
    this.authLoginCustomMessage = settings.authLoginCustomMessage || null
    this.authActiveAuthMethods = settings.authActiveAuthMethods || ['local']

    this.authOpenIDIssuerURL = settings.authOpenIDIssuerURL || null
    this.authOpenIDAuthorizationURL = settings.authOpenIDAuthorizationURL || null
    this.authOpenIDTokenURL = settings.authOpenIDTokenURL || null
    this.authOpenIDUserInfoURL = settings.authOpenIDUserInfoURL || null
    this.authOpenIDJwksURL = settings.authOpenIDJwksURL || null
    this.authOpenIDLogoutURL = settings.authOpenIDLogoutURL || null
    this.authOpenIDClientID = settings.authOpenIDClientID || null
    this.authOpenIDClientSecret = settings.authOpenIDClientSecret || null
    this.authOpenIDTokenSigningAlgorithm = settings.authOpenIDTokenSigningAlgorithm || 'RS256'
    this.authOpenIDButtonText = settings.authOpenIDButtonText || 'Login with OpenId'
    this.authOpenIDAutoLaunch = !!settings.authOpenIDAutoLaunch
    this.authOpenIDAutoRegister = !!settings.authOpenIDAutoRegister
    this.authOpenIDMatchExistingBy = settings.authOpenIDMatchExistingBy || null
    this.authOpenIDMobileRedirectURIs = settings.authOpenIDMobileRedirectURIs || ['audiobookshelf://oauth']
    this.authOpenIDGroupClaim = settings.authOpenIDGroupClaim || ''
    this.authOpenIDAdvancedPermsClaim = settings.authOpenIDAdvancedPermsClaim || ''
    this.authOpenIDSubfolderForRedirectURLs = settings.authOpenIDSubfolderForRedirectURLs

    if (!Array.isArray(this.authActiveAuthMethods)) {
      this.authActiveAuthMethods = ['local']
    }

    // Remove uninitialized OpenID
    if (this.authActiveAuthMethods.includes('openid') && !this.isOpenIDAuthSettingsValid) {
      this.authActiveAuthMethods.splice(this.authActiveAuthMethods.indexOf('openid', 0), 1)
    }
    if (!Array.isArray(this.authActiveAuthMethods) || this.authActiveAuthMethods.length === 0) {
      this.authActiveAuthMethods = ['local']
    }

    // Migrations
    if (settings.storeCoverWithBook != undefined) {
      this.storeCoverWithItem = !!settings.storeCoverWithBook
    }
    if (settings.storeMetadataWithBook != undefined) {
      this.storeMetadataWithItem = !!settings.storeMetadataWithBook
    }
    if (settings.homeBookshelfView == undefined) {
      this.homeBookshelfView = settings.bookshelfView
    }
    if (settings.metadataFileFormat == undefined) {
      this.metadataFileFormat = 'abs'
    }
    if (this.metadataFileFormat !== 'json') {
      Logger.warn(`[ServerSettings] Invalid metadataFileFormat ${this.metadataFileFormat} (as of v2.4.5 only json is supported)`)
      this.metadataFileFormat = 'json'
    }
    if (this.logLevel !== Logger.logLevel) {
      Logger.setLogLevel(this.logLevel)
    }
    if (process.env.BACKUP_PATH && this.backupPath !== process.env.BACKUP_PATH) {
      Logger.info(`[ServerSettings] Using backup path from environment variable ${process.env.BACKUP_PATH}`)
      this.backupPath = process.env.BACKUP_PATH
    }
    if (process.env.ALLOW_IFRAME === '1' && !this.allowIframe) {
      Logger.info(`[ServerSettings] Using allowIframe from environment variable`)
      this.allowIframe = true
    }
  }

  toJSONForBrowser() {
    const json = this.toJSON() as any
    delete json.tokenSecret
    delete json.authOpenIDClientID
    delete json.authOpenIDClientSecret
    delete json.authOpenIDMobileRedirectURIs
    delete json.authOpenIDGroupClaim
    delete json.authOpenIDAdvancedPermsClaim
    return json
  }

  get supportedAuthMethods() {
    return ['local', 'openid']
  }

  get isOpenIDAuthSettingsValid(): boolean {
    return !!(
      this.authOpenIDIssuerURL &&
      this.authOpenIDAuthorizationURL &&
      this.authOpenIDTokenURL &&
      this.authOpenIDUserInfoURL &&
      this.authOpenIDJwksURL &&
      this.authOpenIDClientID &&
      this.authOpenIDClientSecret &&
      this.authOpenIDTokenSigningAlgorithm
    )
  }

  get authenticationSettings() {
    return {
      authLoginCustomMessage: this.authLoginCustomMessage,
      authActiveAuthMethods: this.authActiveAuthMethods,
      authOpenIDIssuerURL: this.authOpenIDIssuerURL,
      authOpenIDAuthorizationURL: this.authOpenIDAuthorizationURL,
      authOpenIDTokenURL: this.authOpenIDTokenURL,
      authOpenIDUserInfoURL: this.authOpenIDUserInfoURL,
      authOpenIDJwksURL: this.authOpenIDJwksURL,
      authOpenIDLogoutURL: this.authOpenIDLogoutURL,
      authOpenIDClientID: this.authOpenIDClientID,
      authOpenIDClientSecret: this.authOpenIDClientSecret,
      authOpenIDTokenSigningAlgorithm: this.authOpenIDTokenSigningAlgorithm,
      authOpenIDButtonText: this.authOpenIDButtonText,
      authOpenIDAutoLaunch: this.authOpenIDAutoLaunch,
      authOpenIDAutoRegister: this.authOpenIDAutoRegister,
      authOpenIDMatchExistingBy: this.authOpenIDMatchExistingBy,
      authOpenIDMobileRedirectURIs: this.authOpenIDMobileRedirectURIs,
      authOpenIDGroupClaim: this.authOpenIDGroupClaim,
      authOpenIDAdvancedPermsClaim: this.authOpenIDAdvancedPermsClaim,
      authOpenIDSubfolderForRedirectURLs: this.authOpenIDSubfolderForRedirectURLs,
      authOpenIDSamplePermissions: User.getSampleAbsPermissions()
    }
  }

  get authFormData() {
    const clientFormData: Record<string, any> = {
      authLoginCustomMessage: this.authLoginCustomMessage
    }
    if (this.authActiveAuthMethods.includes('openid')) {
      clientFormData.authOpenIDButtonText = this.authOpenIDButtonText
      clientFormData.authOpenIDAutoLaunch = this.authOpenIDAutoLaunch
    }
    return clientFormData
  }

  update(payload: Record<string, any>): boolean {
    let hasUpdates = false
    for (const key in payload) {
      if (key === 'sortingPrefixes') continue
      if (key === 'authActiveAuthMethods') {
        if (!payload[key]?.length) {
          Logger.error(`[ServerSettings] Invalid authActiveAuthMethods`, payload[key])
          continue
        }
        this.authActiveAuthMethods.sort()
        payload[key].sort()
        if (payload[key].join() !== this.authActiveAuthMethods.join()) {
          this.authActiveAuthMethods = payload[key]
          hasUpdates = true
        }
      } else if ((this as any)[key] !== payload[key]) {
        if (key === 'logLevel') {
          Logger.setLogLevel(payload[key])
        }
        ;(this as any)[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}

export = ServerSettings
