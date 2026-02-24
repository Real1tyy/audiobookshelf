const Logger = require('../Logger')
const Database = require('../Database')
const fs = require('../libs/fsExtra')

const loggerPrefix = '[TranscriptIndexer]'

/**
 * Index a single transcript into the FTS table
 *
 * @param {string} libraryItemId
 * @param {string} title
 * @param {string} transcriptText
 */
async function indexTranscript(libraryItemId, title, transcriptText) {
  // Delete existing entry for this library item
  await Database.sequelize.query('DELETE FROM transcriptsFts WHERE libraryItemId = :libraryItemId', {
    replacements: { libraryItemId }
  })

  // Insert new entry
  await Database.sequelize.query('INSERT INTO transcriptsFts (libraryItemId, title, transcriptText) VALUES (:libraryItemId, :title, :transcriptText)', {
    replacements: { libraryItemId, title, transcriptText }
  })
  Logger.debug(`${loggerPrefix} Indexed transcript for "${title}" (${libraryItemId}), text length: ${transcriptText.length}`)
}

/**
 * Remove transcript FTS entry for a library item
 *
 * @param {string} libraryItemId
 */
async function removeTranscript(libraryItemId) {
  await Database.sequelize.query('DELETE FROM transcriptsFts WHERE libraryItemId = :libraryItemId', {
    replacements: { libraryItemId }
  })
}

/**
 * Index a transcript from a file on disk and persist it to the book model.
 *
 * @param {string} libraryItemId
 * @param {string} title
 * @param {string} filePath - absolute path to transcript.txt
 * @param {string} [bookId] - optional book ID to persist transcript text to
 */
async function indexTranscriptFromFile(libraryItemId, title, filePath, bookId) {
  try {
    const text = await fs.readFile(filePath, 'utf8')
    if (text && text.trim()) {
      const trimmed = text.trim()
      await indexTranscript(libraryItemId, title, trimmed)

      // Persist transcript text to book model if bookId provided
      if (bookId) {
        await Database.sequelize.query('UPDATE books SET transcript = :transcript WHERE id = :bookId', {
          replacements: { transcript: trimmed, bookId }
        })
      }

      return true
    } else {
      Logger.warn(`${loggerPrefix} Transcript file is empty: "${filePath}"`)
    }
  } catch (error) {
    Logger.error(`${loggerPrefix} Failed to index transcript from file "${filePath}":`, error.message)
  }
  return false
}

/**
 * Save transcript text to the book model and index into FTS.
 *
 * @param {string} libraryItemId
 * @param {string} bookId
 * @param {string} title
 * @param {string} transcriptText
 */
async function saveAndIndex(libraryItemId, bookId, title, transcriptText) {
  // Persist to book model
  await Database.sequelize.query('UPDATE books SET transcript = :transcript WHERE id = :bookId', {
    replacements: { transcript: transcriptText, bookId }
  })

  // Index into FTS
  await indexTranscript(libraryItemId, title, transcriptText)
  Logger.info(`${loggerPrefix} Saved and indexed transcript for "${title}" (${libraryItemId})`)
}

/**
 * Re-index all transcripts in the database.
 * Reads transcript text from the books.transcript column (source of truth)
 * and also checks for transcript.txt files on disk for items without stored transcripts.
 */
async function reindexAll() {
  Logger.info(`${loggerPrefix} Starting full transcript re-index`)

  // Clear existing FTS data
  await Database.sequelize.query('DELETE FROM transcriptsFts')

  // 1. Index all books that have transcript text stored in the DB
  const [dbRows] = await Database.sequelize.query(`
    SELECT li.id AS libraryItemId, li.title, b.transcript
    FROM books b
    JOIN libraryItems li ON li.mediaId = b.id
    WHERE b.transcript IS NOT NULL
      AND b.transcript != ''
  `)

  let indexed = 0
  const indexedItemIds = new Set()

  for (const row of dbRows) {
    try {
      await indexTranscript(row.libraryItemId, row.title, row.transcript)
      indexedItemIds.add(row.libraryItemId)
      indexed++
    } catch (error) {
      Logger.error(`${loggerPrefix} Failed to index transcript from DB for "${row.title}" (${row.libraryItemId}):`, error.message)
    }
  }

  Logger.info(`${loggerPrefix} Indexed ${indexed} transcripts from database`)

  // 2. Also check for transcript.txt files on disk that aren't yet in the DB
  const [fileRows] = await Database.sequelize.query(`
    SELECT li.id AS libraryItemId, li.title, li.mediaId AS bookId,
           json_extract(jf.value, '$.metadata.path') AS transcriptPath
    FROM libraryItems li, json_each(li.libraryFiles) AS jf
    WHERE json_valid(li.libraryFiles)
      AND json_extract(jf.value, '$.metadata.filename') = 'transcript.txt'
  `)

  let fileIndexed = 0
  for (const row of fileRows) {
    if (indexedItemIds.has(row.libraryItemId)) continue // Already indexed from DB

    const success = await indexTranscriptFromFile(row.libraryItemId, row.title, row.transcriptPath, row.bookId)
    if (success) fileIndexed++
  }

  if (fileIndexed > 0) {
    Logger.info(`${loggerPrefix} Indexed ${fileIndexed} additional transcripts from files on disk`)
  }

  const total = indexed + fileIndexed
  Logger.info(`${loggerPrefix} Re-indexed ${total} total transcripts`)
  return total
}

/**
 * Check if the FTS table is empty and run reindexAll if so.
 * Called after migrations complete.
 */
async function reindexIfEmpty() {
  try {
    const [results] = await Database.sequelize.query('SELECT count(*) AS cnt FROM transcriptsFts')
    const count = Number(results[0].cnt)
    Logger.info(`${loggerPrefix} FTS table has ${count} entries`)
    if (count === 0) {
      Logger.info(`${loggerPrefix} FTS table is empty, running full re-index`)
      await reindexAll()
    }
  } catch (error) {
    Logger.error(`${loggerPrefix} Failed to check/reindex transcripts`, error)
  }
}

module.exports = {
  indexTranscript,
  removeTranscript,
  indexTranscriptFromFile,
  saveAndIndex,
  reindexAll,
  reindexIfEmpty
}
