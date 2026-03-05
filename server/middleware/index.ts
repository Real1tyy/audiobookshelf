import { Request, Response, NextFunction } from 'express'
import Logger from '../Logger'

// Re-export the common request type used across all controllers
export interface RequestWithUser extends Request {
  user: import('../models/User')
  [key: string]: any
}

type AsyncHandler = (req: RequestWithUser, res: Response, next: NextFunction) => Promise<any>

/**
 * Wraps an async route handler to catch errors and forward them to Express error handling.
 * Eliminates the need for try/catch in every controller method.
 *
 * @example
 * router.get('/items', asyncHandler(async (req, res) => {
 *   const items = await Database.findAll()
 *   res.json(items)
 * }))
 */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as RequestWithUser, res, next)).catch(next)
  }
}

/**
 * Middleware that requires the user to be an admin or higher.
 * Replaces 44+ inline `if (!req.user.isAdminOrUp)` checks across 14 controllers.
 *
 * @example
 * // As route-level middleware in ApiRouter:
 * router.post('/settings', requireAdmin, MiscController.updateSettings.bind(this))
 *
 * // Inside a controller method (early return):
 * if (!req.user.isAdminOrUp) return res.sendStatus(403) // old way
 */
export function requireAdmin(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user.isAdminOrUp) {
    Logger.error(`[Auth] Non-admin user "${req.user.username}" attempted to access ${req.method} ${req.path}`)
    return res.sendStatus(403)
  }
  next()
}

/**
 * Factory for permission-checking middleware.
 *
 * @example
 * router.post('/upload', requirePermission('canUpload'), controller.upload)
 */
export function requirePermission(permission: 'canDelete' | 'canUpdate' | 'canUpload' | 'canDownload') {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!(req.user as any)[permission]) {
      Logger.warn(`[Auth] User "${req.user.username}" lacks ${permission} for ${req.method} ${req.path}`)
      return res.sendStatus(403)
    }
    next()
  }
}

/**
 * Standard method-based permission checks used in most controller middleware.
 * DELETE requires canDelete, PATCH/POST requires canUpdate.
 * Returns middleware that can be chained in the router.
 *
 * @example
 * // In ApiRouter:
 * const authorPerms = checkMethodPermissions('AuthorController')
 * router.patch('/authors/:id', AuthorController.middleware, authorPerms, AuthorController.update)
 *
 * // Or called inside a controller's middleware function:
 * async middleware(req, res, next) {
 *   const author = await Database.authorModel.findByPk(req.params.id)
 *   if (!author) return res.sendStatus(404)
 *   req.author = author
 *   checkMethodPermissions('AuthorController')(req, res, next)
 * }
 */
export function checkMethodPermissions(controllerName: string) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (req.method === 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[${controllerName}] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    }
    if ((req.method === 'PATCH' || req.method === 'POST') && !req.user.canUpdate) {
      Logger.warn(`[${controllerName}] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }
    next()
  }
}

module.exports = { asyncHandler, requireAdmin, requirePermission, checkMethodPermissions }
