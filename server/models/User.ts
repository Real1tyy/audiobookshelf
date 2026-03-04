import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, Sequelize, Op, where as sqWhere, literal } from 'sequelize'
import { LRUCache } from 'lru-cache'
import { v4 as uuidv4 } from 'uuid'

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const { isNullOrNaN } = require('../utils')
const TokenManager = require('../auth/TokenManager')

interface AudioBookmarkObject {
  libraryItemId: string
  title: string
  time: number
  createdAt: number
}

class UserCache {
  cache: LRUCache<string, any>

  constructor() {
    this.cache = new LRUCache({ max: 100 })
  }

  getById(id: string) {
    return this.cache.get(id)
  }

  getByEmail(email: string) {
    return this.cache.find((u: any) => u.email === email)
  }

  getByUsername(username: string) {
    return this.cache.find((u: any) => u.username === username)
  }

  getByOldId(oldUserId: string) {
    return this.cache.find((u: any) => u.extraData?.oldUserId === oldUserId)
  }

  getByOpenIDSub(sub: string) {
    return this.cache.find((u: any) => u.extraData?.authOpenIDSub === sub)
  }

  set(user: any) {
    user.fromCache = true
    this.cache.set(user.id, user)
  }

  delete(userId: string) {
    this.cache.delete(userId)
  }

  maybeInvalidate(user: any) {
    if (!user.fromCache) this.delete(user.id)
  }
}

const userCache = new UserCache()

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>
  declare username: string | null
  declare email: string | null
  declare pash: string | null
  declare type: string
  declare token: string | null
  declare isActive: CreationOptional<boolean>
  declare isLocked: CreationOptional<boolean>
  declare lastSeen: Date | null
  declare permissions: any | null
  declare bookmarks: AudioBookmarkObject[] | null
  declare extraData: any | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties
  declare mediaProgresses?: NonAttribute<any[]>

  // Runtime flag (not persisted)
  declare isOldToken?: NonAttribute<boolean>

  static accountTypes = ['admin', 'user', 'guest']

  static permissionMapping: Record<string, string> = {
    canDownload: 'download',
    canUpload: 'upload',
    canDelete: 'delete',
    canUpdate: 'update',
    canAccessExplicitContent: 'accessExplicitContent',
    canAccessAllLibraries: 'accessAllLibraries',
    canAccessAllTags: 'accessAllTags',
    canCreateEReader: 'createEreader',
    tagsAreDenylist: 'selectedTagsNotAccessible',
    allowedLibraries: 'librariesAccessible',
    allowedTags: 'itemTagsSelected'
  }

  static getSampleAbsPermissions(): string {
    const samplePermissions = Object.keys(User.permissionMapping).reduce((acc: any, key) => {
      if (key === 'allowedLibraries') {
        acc[key] = [`5406ba8a-16e1-451d-96d7-4931b0a0d966`, `918fd848-7c1d-4a02-818a-847435a879ca`]
      } else if (key === 'allowedTags') {
        acc[key] = [`ExampleTag`, `AnotherTag`, `ThirdTag`]
      } else {
        acc[key] = false
      }
      return acc
    }, {})

    return JSON.stringify(samplePermissions, null, 2)
  }

  static getDefaultPermissionsForUserType(type: string) {
    return {
      download: true,
      update: type === 'root' || type === 'admin',
      delete: type === 'root',
      upload: type === 'root' || type === 'admin',
      createEreader: type === 'root' || type === 'admin',
      accessAllLibraries: true,
      accessAllTags: true,
      accessExplicitContent: type === 'root' || type === 'admin',
      selectedTagsNotAccessible: false,
      librariesAccessible: [] as string[],
      itemTagsSelected: [] as string[]
    }
  }

  static async createRootUser(username: string, pash: string, auth: any) {
    const userId = uuidv4()

    const token = auth.generateAccessToken({ id: userId, username })

    const newUser = {
      id: userId,
      type: 'root',
      username,
      pash,
      token,
      isActive: true,
      permissions: this.getDefaultPermissionsForUserType('root'),
      bookmarks: [],
      extraData: {
        seriesHideFromContinueListening: []
      }
    }
    return this.create(newUser as any)
  }

  static async findUserFromOpenIdUserInfo(userinfo: any): Promise<User | { error: string } | null> {
    let user = await this.getUserByOpenIDSub(userinfo.sub)

    if (user) {
      Logger.debug(`[User] openid: User found by sub "${userinfo.sub}"`)
      return user
    }

    if ((global as any).ServerSettings.authOpenIDMatchExistingBy === 'email') {
      if (userinfo.email) {
        if (userinfo.email_verified === false) {
          Logger.warn(`[User] openid: User not found and email "${userinfo.email}" is not verified`)
          return { error: 'Email not verified' }
        } else {
          Logger.info(`[User] openid: User not found, checking existing with email "${userinfo.email}"`)
          user = await this.getUserByEmail(userinfo.email)

          if (user?.authOpenIDSub) {
            Logger.warn(`[User] openid: User found with email "${userinfo.email}" but is already matched with sub "${user.authOpenIDSub}"`)
            return { error: 'User already linked to a different OpenID subject' }
          }
        }
      } else {
        Logger.warn(`[User] openid: User not found and no email in userinfo`)
        return { error: 'No email in userinfo' }
      }
    } else if ((global as any).ServerSettings.authOpenIDMatchExistingBy === 'username') {
      let username

      if (userinfo.preferred_username) {
        Logger.info(`[User] openid: User not found, checking existing with userinfo.preferred_username "${userinfo.preferred_username}"`)
        username = userinfo.preferred_username
      } else if (userinfo.username) {
        Logger.info(`[User] openid: User not found, checking existing with userinfo.username "${userinfo.username}"`)
        username = userinfo.username
      } else {
        Logger.warn(`[User] openid: User not found and neither preferred_username nor username in userinfo`)
        return { error: 'No username in userinfo' }
      }

      user = await this.getUserByUsername(username)

      if (user?.authOpenIDSub) {
        Logger.warn(`[User] openid: User found with username "${username}" but is already matched with sub "${user.authOpenIDSub}"`)
        return { error: 'User already linked to a different OpenID subject' }
      }
    }

    if (!user) {
      return null
    }

    if (!user.isActive) {
      Logger.warn(`[User] openid: User found but is not active`)
      return user
    }

    if (!user.extraData) user.extraData = {}
    user.extraData.authOpenIDSub = userinfo.sub
    user.changed('extraData', true)
    await user.save()

    Logger.debug(`[User] openid: User found by email/username`)
    return user
  }

  static async createUserFromOpenIdUserInfo(userinfo: any): Promise<User | null> {
    const userId = uuidv4()
    const username = userinfo.preferred_username || userinfo.name || userinfo.sub
    const email = userinfo.email && userinfo.email_verified ? userinfo.email : null

    const token = TokenManager.generateAccessToken({ id: userId, username })

    const newUser = {
      id: userId,
      type: 'user',
      username,
      email,
      pash: null,
      token,
      isActive: true,
      permissions: this.getDefaultPermissionsForUserType('user'),
      bookmarks: [],
      extraData: {
        authOpenIDSub: userinfo.sub,
        seriesHideFromContinueListening: []
      }
    }
    const user = await this.create(newUser as any)

    if (user) {
      SocketAuthority.adminEmitter('user_added', user.toOldJSONForBrowser())
      return user
    }
    return null
  }

  static async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null

    const cachedUser = userCache.getByUsername(username)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: {
        username: {
          [Op.like]: username
        }
      },
      include: this.sequelize!.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null

    const cachedUser = userCache.getByEmail(email)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: {
        email: {
          [Op.like]: email
        }
      },
      include: this.sequelize!.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  static async getUserById(userId: string): Promise<User | null> {
    if (!userId) return null

    const cachedUser = userCache.getById(userId)
    if (cachedUser) return cachedUser

    const user = await this.findByPk(userId, {
      include: this.sequelize!.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  static async getUserByIdOrOldId(userId: string): Promise<User | null> {
    if (!userId) return null
    const cachedUser = userCache.getById(userId) || userCache.getByOldId(userId)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: {
        [Op.or]: [{ id: userId }, { 'extraData.oldUserId': userId }]
      },
      include: this.sequelize!.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  static async getUserByOpenIDSub(sub: string): Promise<User | null> {
    if (!sub) return null

    const cachedUser = userCache.getByOpenIDSub(sub)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: sqWhere(literal(`extraData->>"authOpenIDSub"`), sub),
      include: this.sequelize!.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  static async getMinifiedUserObjects() {
    const users = await this.findAll({
      attributes: ['id', 'username']
    })
    return users.map((u) => {
      return {
        id: u.id,
        username: u.username
      }
    })
  }

  static async getHasRootUser(): Promise<boolean> {
    const count = await this.count({
      where: {
        type: 'root'
      }
    })
    return count > 0
  }

  static async checkUserExistsWithUsername(username: string): Promise<boolean> {
    const count = await this.count({
      where: {
        username
      }
    })
    return count > 0
  }

  static mediaProgressRemoved(mediaProgress: any) {
    const cachedUser = userCache.getById(mediaProgress.userId)
    if (cachedUser) {
      Logger.debug(`[User] mediaProgressRemoved: ${mediaProgress.id} from user ${cachedUser.id}`)
      cachedUser.mediaProgresses = cachedUser.mediaProgresses.filter((mp: any) => mp.id !== mediaProgress.id)
    }
  }

  static init(...args: any[]): any {
    const sequelize = args[0] as Sequelize
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        username: DataTypes.STRING,
        email: DataTypes.STRING,
        pash: DataTypes.STRING,
        type: DataTypes.STRING,
        token: DataTypes.STRING,
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        isLocked: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        lastSeen: DataTypes.DATE,
        permissions: DataTypes.JSON,
        bookmarks: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'user'
      }
    )
  }

  get isRoot(): boolean {
    return this.type === 'root'
  }
  get isAdminOrUp(): boolean {
    return this.isRoot || this.type === 'admin'
  }
  get isUser(): boolean {
    return this.type === 'user'
  }
  get isGuest(): boolean {
    return this.type === 'guest'
  }
  get canAccessExplicitContent(): boolean {
    return !!this.permissions?.accessExplicitContent && this.isActive
  }
  get canDelete(): boolean {
    return !!this.permissions?.delete && this.isActive
  }
  get canUpdate(): boolean {
    return !!this.permissions?.update && this.isActive
  }
  get canDownload(): boolean {
    return !!this.permissions?.download && this.isActive
  }
  get canUpload(): boolean {
    return !!this.permissions?.upload && this.isActive
  }
  get authOpenIDSub(): string | null {
    return this.extraData?.authOpenIDSub || null
  }

  toJSONForPublic(sessions: any[]) {
    const session = sessions?.find((s: any) => s.userId === this.id)?.toJSONForClient() || null
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      session,
      lastSeen: this.lastSeen?.valueOf() || null,
      createdAt: this.createdAt.valueOf()
    }
  }

  toOldJSONForBrowser(hideRootToken = false, minimal = false) {
    const seriesHideFromContinueListening = this.extraData?.seriesHideFromContinueListening || []
    const librariesAccessible = this.permissions?.librariesAccessible || []
    const itemTagsSelected = this.permissions?.itemTagsSelected || []
    const permissions = { ...this.permissions }
    delete permissions.librariesAccessible
    delete permissions.itemTagsSelected

    const json: any = {
      id: this.id,
      username: this.username,
      email: this.email,
      type: this.type,
      token: this.type === 'root' && hideRootToken ? '' : this.token,
      isOldToken: this.isOldToken,
      mediaProgress: this.mediaProgresses?.map((mp: any) => mp.getOldMediaProgress()) || [],
      seriesHideFromContinueListening: [...seriesHideFromContinueListening],
      bookmarks: this.bookmarks?.map((b: any) => ({ ...b })) || [],
      isActive: this.isActive,
      isLocked: this.isLocked,
      lastSeen: this.lastSeen?.valueOf() || null,
      createdAt: this.createdAt.valueOf(),
      permissions: permissions,
      librariesAccessible: [...librariesAccessible],
      itemTagsSelected: [...itemTagsSelected],
      hasOpenIDLink: !!this.authOpenIDSub
    }
    if (minimal) {
      delete json.mediaProgress
      delete json.bookmarks
    }
    return json
  }

  checkCanAccessLibrary(libraryId: string): boolean {
    if (this.permissions?.accessAllLibraries) return true
    if (!this.permissions?.librariesAccessible) return false
    return this.permissions.librariesAccessible.includes(libraryId)
  }

  checkCanAccessLibraryItemWithTags(tags: string[]): boolean {
    if (this.permissions.accessAllTags) return true
    const itemTagsSelected = this.permissions?.itemTagsSelected || []
    if (this.permissions.selectedTagsNotAccessible) {
      if (!tags?.length) return true
      return tags.every((tag: string) => !itemTagsSelected?.includes(tag))
    }
    if (!tags?.length) return false
    return itemTagsSelected.some((tag: string) => tags.includes(tag))
  }

  checkCanAccessLibraryItem(libraryItem: any): boolean {
    if (!this.checkCanAccessLibrary(libraryItem.libraryId)) return false

    const libraryItemExplicit = !!libraryItem.media.explicit || !!libraryItem.media.metadata?.explicit

    if (libraryItemExplicit && !this.canAccessExplicitContent) return false

    return this.checkCanAccessLibraryItemWithTags(libraryItem.media.tags)
  }

  getDefaultLibraryId(libraryIds: string[]): string | null {
    return libraryIds.find((lid: string) => this.checkCanAccessLibrary(lid)) || null
  }

  getMediaProgress(mediaItemId: string) {
    if (!this.mediaProgresses?.length) return null
    return this.mediaProgresses.find((mp: any) => mp.mediaItemId === mediaItemId)
  }

  getOldMediaProgress(libraryItemId: string) {
    const mediaProgress = this.mediaProgresses?.find((mp: any) => {
      return mp.extraData?.libraryItemId === libraryItemId
    })
    return mediaProgress?.getOldMediaProgress() || null
  }

  async createUpdateMediaProgressFromPayload(progressPayload: any) {
    let mediaProgress: any = null
    let mediaItemId: string | null = null

    const libraryItem = await this.sequelize!.models.libraryItem.findByPk(progressPayload.libraryItemId, {
      attributes: ['id', 'mediaId', 'mediaType'],
      include: {
        model: this.sequelize!.models.book,
        attributes: ['id', 'title'],
        required: false,
        include: [{
          model: this.sequelize!.models.mediaProgress,
          where: { userId: this.id },
          required: false
        }]
      }
    }) as any
    if (!libraryItem) {
      Logger.error(`[User] createUpdateMediaProgress: library item ${progressPayload.libraryItemId} not found`)
      return {
        error: 'Library item not found',
        statusCode: 404
      }
    }
    mediaItemId = libraryItem.media.id
    mediaProgress = libraryItem.media.mediaProgresses?.[0]

    if (mediaProgress) {
      mediaProgress = await mediaProgress.applyProgressUpdate(progressPayload)
      this.mediaProgresses = this.mediaProgresses!.map((mp: any) => (mp.id === mediaProgress.id ? mediaProgress : mp))
    } else {
      const newMediaProgressPayload = {
        userId: this.id,
        mediaItemId,
        mediaItemType: 'book',
        duration: isNullOrNaN(progressPayload.duration) ? 0 : Number(progressPayload.duration),
        currentTime: isNullOrNaN(progressPayload.currentTime) ? 0 : Number(progressPayload.currentTime),
        isFinished: !!progressPayload.isFinished,
        hideFromContinueListening: !!progressPayload.hideFromContinueListening,
        ebookLocation: progressPayload.ebookLocation || null,
        ebookProgress: isNullOrNaN(progressPayload.ebookProgress) ? 0 : Number(progressPayload.ebookProgress),
        finishedAt: progressPayload.finishedAt || null,
        createdAt: progressPayload.createdAt || new Date(),
        extraData: {
          libraryItemId: progressPayload.libraryItemId,
          progress: isNullOrNaN(progressPayload.progress) ? 0 : Number(progressPayload.progress)
        }
      }
      if (newMediaProgressPayload.isFinished) {
        newMediaProgressPayload.finishedAt = newMediaProgressPayload.finishedAt || new Date()
        newMediaProgressPayload.extraData.progress = 1
      } else {
        newMediaProgressPayload.finishedAt = null
      }
      mediaProgress = await this.sequelize!.models.mediaProgress.create(newMediaProgressPayload as any)
      this.mediaProgresses!.push(mediaProgress)
    }
    userCache.maybeInvalidate(this)
    return {
      mediaProgress
    }
  }

  findBookmark(libraryItemId: string, time: number): AudioBookmarkObject | undefined {
    return this.bookmarks?.find((bm) => bm.libraryItemId === libraryItemId && bm.time == time)
  }

  async createBookmark(libraryItemId: string, time: number, title: string): Promise<AudioBookmarkObject> {
    const existingBookmark = this.findBookmark(libraryItemId, time)
    if (existingBookmark) {
      Logger.warn('[User] Create Bookmark already exists for this time')
      if (existingBookmark.title !== title) {
        existingBookmark.title = title
        this.changed('bookmarks', true)
        await this.save()
      }
      return existingBookmark
    }

    const newBookmark: AudioBookmarkObject = {
      libraryItemId,
      time,
      title,
      createdAt: Date.now()
    }
    this.bookmarks!.push(newBookmark)
    this.changed('bookmarks', true)
    await this.save()
    return newBookmark
  }

  async updateBookmark(libraryItemId: string, time: number, title: string): Promise<AudioBookmarkObject | null> {
    const bookmark = this.findBookmark(libraryItemId, time)
    if (!bookmark) {
      Logger.error(`[User] updateBookmark not found`)
      return null
    }
    bookmark.title = title
    this.changed('bookmarks', true)
    await this.save()
    return bookmark
  }

  async removeBookmark(libraryItemId: string, time: number): Promise<boolean> {
    if (!this.findBookmark(libraryItemId, time)) {
      Logger.error(`[User] removeBookmark not found`)
      return false
    }
    this.bookmarks = this.bookmarks!.filter((bm) => bm.libraryItemId !== libraryItemId || bm.time !== time)
    this.changed('bookmarks', true)
    await this.save()
    return true
  }

  async addSeriesToHideFromContinueListening(seriesId: string): Promise<boolean> {
    if (!this.extraData) this.extraData = {}
    const seriesHideFromContinueListening = this.extraData.seriesHideFromContinueListening || []
    if (seriesHideFromContinueListening.includes(seriesId)) return false
    seriesHideFromContinueListening.push(seriesId)
    this.extraData.seriesHideFromContinueListening = seriesHideFromContinueListening
    this.changed('extraData', true)
    await this.save()
    return true
  }

  async removeSeriesFromHideFromContinueListening(seriesId: string): Promise<boolean> {
    if (!this.extraData) this.extraData = {}
    let seriesHideFromContinueListening = this.extraData.seriesHideFromContinueListening || []
    if (!seriesHideFromContinueListening.includes(seriesId)) return false
    seriesHideFromContinueListening = seriesHideFromContinueListening.filter((sid: string) => sid !== seriesId)
    this.extraData.seriesHideFromContinueListening = seriesHideFromContinueListening
    this.changed('extraData', true)
    await this.save()
    return true
  }

  getPlayerQueue() {
    if (!this.extraData) return { items: [], autoPlay: true, currentIndex: 0, currentTime: 0 }
    return {
      items: this.extraData.playerQueueItems || [],
      autoPlay: this.extraData.playerQueueAutoPlay !== false,
      currentIndex: this.extraData.playerQueueCurrentIndex || 0,
      currentTime: this.extraData.playerQueueCurrentTime || 0
    }
  }

  async setPlayerQueue(queueItems: any[], autoPlay = true, currentIndex = 0, currentTime = 0): Promise<boolean> {
    if (!this.extraData) this.extraData = {}
    this.extraData.playerQueueItems = queueItems || []
    this.extraData.playerQueueAutoPlay = !!autoPlay
    this.extraData.playerQueueCurrentIndex = currentIndex || 0
    this.extraData.playerQueueCurrentTime = currentTime || 0
    this.changed('extraData', true)
    await this.save()
    return true
  }

  async clearPlayerQueue(): Promise<boolean> {
    if (!this.extraData) this.extraData = {}
    this.extraData.playerQueueItems = []
    this.changed('extraData', true)
    await this.save()
    return true
  }

  async updatePermissionsFromExternalJSON(absPermissions: any): Promise<boolean> {
    if (!this.permissions) this.permissions = {}
    let hasUpdates = false

    Object.keys(absPermissions).forEach((absKey) => {
      const userPermKey = User.permissionMapping[absKey]
      if (!userPermKey) {
        throw new Error(`Unexpected permission property: ${absKey}`)
      }

      if (!['librariesAccessible', 'itemTagsSelected'].includes(userPermKey)) {
        if (this.permissions[userPermKey] !== !!absPermissions[absKey]) {
          this.permissions[userPermKey] = !!absPermissions[absKey]
          hasUpdates = true
        }
      }
    })

    const librariesAccessible = this.permissions.librariesAccessible || []
    if (this.permissions.accessAllLibraries) {
      if (librariesAccessible.length) {
        this.permissions.librariesAccessible = []
        hasUpdates = true
      }
    } else if (absPermissions.allowedLibraries?.length && absPermissions.allowedLibraries.join(',') !== librariesAccessible.join(',')) {
      if (absPermissions.allowedLibraries.some((lid: any) => typeof lid !== 'string')) {
        throw new Error('Invalid permission property "allowedLibraries", expecting array of strings')
      }
      this.permissions.librariesAccessible = absPermissions.allowedLibraries
      hasUpdates = true
    }

    const itemTagsSelected = this.permissions.itemTagsSelected || []
    if (this.permissions.accessAllTags) {
      if (itemTagsSelected.length) {
        this.permissions.itemTagsSelected = []
        hasUpdates = true
      }
    } else if (absPermissions.allowedTags?.length && absPermissions.allowedTags.join(',') !== itemTagsSelected.join(',')) {
      if (absPermissions.allowedTags.some((tag: any) => typeof tag !== 'string')) {
        throw new Error('Invalid permission property "allowedTags", expecting array of strings')
      }
      this.permissions.itemTagsSelected = absPermissions.allowedTags
      hasUpdates = true
    }

    if (hasUpdates) {
      this.changed('permissions', true)
      await this.save()
    }

    return hasUpdates
  }

  async update(values: any, options?: any) {
    userCache.maybeInvalidate(this)
    return await super.update(values, options)
  }

  async save(options?: any) {
    userCache.maybeInvalidate(this)
    return await super.save(options)
  }

  async destroy(options?: any) {
    userCache.delete(this.id)
    await super.destroy(options)
  }
}

export = User
