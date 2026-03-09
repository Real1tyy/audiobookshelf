const Sequelize = require('sequelize')

/**
 * Decode a filter value from a URL parameter.
 * Handles double-encoding resilience: decodes up to 2 times.
 */
function decodeFilterValue(text: string): string {
  let v = text
  try {
    v = decodeURIComponent(v)
    if (/%[0-9A-Fa-f]{2}/.test(v)) {
      v = decodeURIComponent(v)
    }
  } catch (_e) {
    // keep original
  }
  return Buffer.from(v, 'base64').toString()
}

/**
 * Append user permission SQL clauses for explicit content and tag restrictions.
 * Returns SQL fragment to append to an existing query that references table alias `b` for books.
 */
function appendUserPermissionSql(user: any): string {
  let sql = ''
  if (!user.canAccessExplicitContent) {
    sql += ' AND b.explicit = 0'
  }
  if (!user.permissions?.accessAllTags && user.permissions?.itemTagsSelected?.length) {
    if (user.permissions.selectedTagsNotAccessible) {
      sql += ' AND (SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected)) = 0'
    } else {
      sql += ' AND (SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected)) > 0'
    }
  }
  return sql
}

/**
 * Get a Sequelize literal for filtering out single-book series.
 */
function getHideSingleBookSeriesLiteral(): any {
  return Sequelize.literal('(SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id) > 1')
}

module.exports = { decodeFilterValue, appendUserPermissionSql, getHideSingleBookSeriesLiteral }
