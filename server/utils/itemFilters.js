/**
 * Shared utility module for filtering and sorting library items
 * Used across AuthorController, LibraryController, and other modules
 *
 * This module provides in-memory filtering and sorting for library items.
 * For database-level filtering (more efficient for large datasets), use libraryFilters.getFilteredLibraryItems
 *
 * Supported filter types (matching frontend LibraryFilterSelect.vue):
 * - Book filters: genres, tags, series, authors, narrators, publishers, publishedDecades,
 *   languages, progress, missing, tracks, ebooks, abridged, issues, feed-open, explicit, share-open
 * - Podcast filters: genres, tags, languages, issues, feed-open, explicit
 * - Series filters: genres, tags, authors, narrators, publishers, languages, progress
 */

/**
 * Apply search query filter to library items
 * @param {Array} libraryItems - Array of library items to filter
 * @param {string} searchQuery - Search query string
 * @returns {Array} Filtered library items
 */
function applySearchFilter(libraryItems, searchQuery) {
  if (!searchQuery) return libraryItems

  const searchLower = searchQuery.toLowerCase()
  return libraryItems.filter((li) => {
    const title = li.media?.title?.toLowerCase() || ''
    return title.includes(searchLower)
  })
}

/**
 * Apply progress filter to library items
 * @param {Array} libraryItems - Array of library items to filter
 * @param {string} filterBy - Filter type: 'all'|'finished'|'in-progress'|'not-started'|'not-finished'
 * @param {Object} user - User object with mediaProgress
 * @returns {Array} Filtered library items
 */
function applyProgressFilter(libraryItems, filterBy, user) {
  if (!filterBy || filterBy === 'all' || !user) return libraryItems

  return libraryItems.filter((li) => {
    const progress = user.mediaProgress?.find((mp) => mp.libraryItemId === li.id)

    switch (filterBy) {
      case 'finished':
        return progress && progress.isFinished
      case 'in-progress':
        return progress && !progress.isFinished && progress.progress > 0
      case 'not-started':
        return !progress || progress.progress === 0
      case 'not-finished':
        return !progress || !progress.isFinished
      default:
        return true
    }
  })
}

/**
 * Apply advanced filter to library items (genres, tags, authors, etc.)
 * @param {Array} libraryItems - Array of library items to filter
 * @param {string} filterGroup - Filter group (e.g., 'genres', 'tags', 'authors')
 * @param {string} filterValue - Filter value
 * @returns {Array} Filtered library items
 */
function applyAdvancedFilter(libraryItems, filterGroup, filterValue) {
  if (!filterGroup || !filterValue) return libraryItems

  return libraryItems.filter((li) => {
    const media = li.media
    if (!media) return false

    switch (filterGroup) {
      case 'genres':
        return media.genres?.includes(filterValue)

      case 'tags':
        return media.tags?.includes(filterValue) || li.tags?.includes(filterValue)

      case 'authors':
        return media.authors?.some(au => au.id === filterValue)

      case 'series':
        if (filterValue === 'no-series') {
          return !media.series || media.series.length === 0
        }
        return media.series?.some(s => s.id === filterValue)

      case 'narrators':
        return media.narrators?.includes(filterValue)

      case 'publishers':
        return media.publisher === filterValue

      case 'publishedDecades':
        if (media.publishedYear) {
          const decade = Math.floor(media.publishedYear / 10) * 10
          return decade.toString() === filterValue
        }
        return false

      case 'languages':
        return media.language === filterValue

      case 'tracks':
        const audioFileCount = media.audioFiles?.length || 0
        if (filterValue === 'none') return audioFileCount === 0
        if (filterValue === 'single') return audioFileCount === 1
        if (filterValue === 'multi') return audioFileCount > 1
        return false

      case 'ebooks':
        const hasEbook = !!media.ebookFile
        const hasSupplementary = media.ebookFile?.isSupplementary
        if (filterValue === 'ebook') return hasEbook
        if (filterValue === 'no-ebook') return !hasEbook
        if (filterValue === 'supplementary') return hasSupplementary
        if (filterValue === 'no-supplementary') return !hasSupplementary
        return false

      case 'missing':
        // Check if specific metadata field is missing
        const missingFields = {
          'asin': !media.asin,
          'isbn': !media.isbn,
          'authors': !media.authors || media.authors.length === 0,
          'chapters': !media.chapters || media.chapters.length === 0,
          'cover': !media.coverPath,
          'description': !media.description,
          'genres': !media.genres || media.genres.length === 0,
          'language': !media.language,
          'narrators': !media.narrators || media.narrators.length === 0,
          'publishedYear': !media.publishedYear,
          'publisher': !media.publisher,
          'series': !media.series || media.series.length === 0,
          'subtitle': !media.subtitle,
          'tags': !media.tags || media.tags.length === 0
        }
        return missingFields[filterValue] || false

      case 'abridged':
        return media.abridged === true

      case 'explicit':
        return media.explicit === true

      case 'issues':
        return li.isMissing || li.isInvalid

      case 'feed-open':
        return !!li.rssFeed || !!li.feeds?.length

      case 'share-open':
        return !!li.mediaItemShare

      default:
        return true
    }
  })
}

/**
 * Get sort value from library item based on sort field
 * @param {Object} libraryItem - Library item
 * @param {string} sortBy - Sort field
 * @param {Object} user - User object (for progress sorting)
 * @returns {any} Sort value
 */
function getSortValue(libraryItem, sortBy, user) {
  switch (sortBy) {
    case 'title':
      return libraryItem.media?.title?.toLowerCase() || ''
    case 'publishedYear':
      return libraryItem.media?.publishedYear || 0
    case 'addedAt':
      return libraryItem.addedAt || 0
    case 'size':
      return libraryItem.size || 0
    case 'duration':
      return libraryItem.media?.duration || 0
    case 'progress':
      if (user) {
        const progress = user.mediaProgress?.find((mp) => mp.libraryItemId === libraryItem.id)
        return progress?.progress || 0
      }
      return 0
    default:
      return libraryItem.addedAt || 0
  }
}

/**
 * Sort library items
 * @param {Array} libraryItems - Array of library items to sort
 * @param {string} sortBy - Sort field: 'title'|'publishedYear'|'addedAt'|'size'|'duration'|'progress'|'random'
 * @param {boolean} sortDesc - Sort descending if true
 * @param {Object} user - User object (for progress sorting)
 * @returns {Array} Sorted library items
 */
function sortLibraryItems(libraryItems, sortBy, sortDesc = true, user = null) {
  if (sortBy === 'random') {
    return [...libraryItems].sort(() => Math.random() - 0.5)
  }

  return [...libraryItems].sort((a, b) => {
    const aValue = getSortValue(a, sortBy, user)
    const bValue = getSortValue(b, sortBy, user)

    if (typeof aValue === 'string') {
      return sortDesc ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
    } else {
      return sortDesc ? bValue - aValue : aValue - bValue
    }
  })
}

/**
 * Parse filter string into group and value
 * Format: "group.encodedValue" or just "group"
 * @param {string} filterBy - Filter string
 * @returns {{filterGroup: string|null, filterValue: string|null}}
 */
function parseFilterString(filterBy) {
  if (!filterBy || filterBy === 'all') {
    return { filterGroup: null, filterValue: null }
  }

  const parts = filterBy.split('.')
  if (parts.length === 1) {
    // Simple filter like 'abridged', 'issues', 'feed-open'
    return { filterGroup: parts[0], filterValue: parts[0] }
  }

  // Complex filter like 'genres.encodedValue'
  const filterGroup = parts[0]
  const encodedValue = parts.slice(1).join('.')

  // Decode the value (base64)
  try {
    const filterValue = Buffer.from(decodeURIComponent(encodedValue), 'base64').toString()
    return { filterGroup, filterValue }
  } catch (error) {
    return { filterGroup, filterValue: encodedValue }
  }
}

/**
 * Parse one-or-many filters.
 *
 * Backwards compatible with the existing single filter format, but also supports
 * comma-separated filters to allow AND-combinations:
 * - "genres.<encoded>,tags.<encoded>,progress.<encoded>"
 *
 * Notes:
 * - Filters are applied in-order by the caller (AND semantics via sequential filtering).
 * - "all" yields an empty list.
 *
 * @param {string|string[]|null|undefined} filterBy
 * @returns {{ filterGroup: string|null, filterValue: string|null }[]}
 */
function parseFilters(filterBy) {
  if (!filterBy) return []

  // Express can parse repeated query params into an array, e.g. ?filter=a&filter=b
  const rawFilters = Array.isArray(filterBy) ? filterBy : String(filterBy).split(',')
  const parsed = rawFilters
    .map((f) => (typeof f === 'string' ? f.trim() : ''))
    .filter((f) => !!f && f !== 'all')
    .map((f) => parseFilterString(f))
    .filter((p) => p.filterGroup && p.filterValue)

  return parsed
}

/**
 * Apply filtering and sorting to library items
 * @param {Array} libraryItems - Array of library items
 * @param {Object} options - Filter and sort options
 * @param {string} options.searchQuery - Search query string
 * @param {string} options.filterBy - Progress filter: 'all'|'finished'|'in-progress'|'not-started'|'not-finished' or complex filter
 * @param {string} options.sortBy - Sort field: 'title'|'publishedYear'|'addedAt'|'size'|'duration'|'progress'|'random'
 * @param {boolean} options.sortDesc - Sort descending if true
 * @param {Object} options.user - User object
 * @returns {Array} Filtered and sorted library items
 */
function filterAndSortLibraryItems(libraryItems, options = {}) {
  const {
    searchQuery = null,
    filterBy = 'all',
    sortBy = 'addedAt',
    sortDesc = true,
    user = null
  } = options

  let filtered = libraryItems

  // Apply search filter
  if (searchQuery) {
    filtered = applySearchFilter(filtered, searchQuery)
  }

  // Parse one-or-many filters and apply them sequentially (AND semantics)
  const filters = parseFilters(filterBy)
  for (const { filterGroup, filterValue } of filters) {
    if (filterGroup === 'progress' && user) {
      filtered = applyProgressFilter(filtered, filterValue, user)
    } else if (filterGroup && filterValue) {
      filtered = applyAdvancedFilter(filtered, filterGroup, filterValue)
    }
  }

  // Apply sorting (skip if sortBy is null to preserve existing order)
  if (sortBy !== null) {
    filtered = sortLibraryItems(filtered, sortBy, sortDesc, user)
  }

  return filtered
}

/**
 * Parse query parameters for filtering and sorting
 * @param {Object} query - Express request query object
 * @returns {Object} Parsed options
 */
function parseFilterSortQuery(query) {
  return {
    searchQuery: query.search || null,
    filterBy: query.filter || 'all',
    sortBy: query.sort || 'addedAt',
    sortDesc: query.desc === '0' ? false : true
  }
}

module.exports = {
  applySearchFilter,
  applyProgressFilter,
  applyAdvancedFilter,
  sortLibraryItems,
  filterAndSortLibraryItems,
  parseFilterSortQuery,
  parseFilters,
  parseFilterString,
  getSortValue
}
