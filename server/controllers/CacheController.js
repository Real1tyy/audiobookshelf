const { Request, Response } = require('express')
const CacheManager = require('../managers/CacheManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class CacheController {
  constructor() {}

  /**
   * POST: /api/cache/purge
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async purgeCache(req, res) {
    await CacheManager.purgeAll()
    res.sendStatus(200)
  }

  /**
   * POST: /api/cache/items/purge
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async purgeItemsCache(req, res) {
    await CacheManager.purgeItems()
    res.sendStatus(200)
  }
}
module.exports = new CacheController()
