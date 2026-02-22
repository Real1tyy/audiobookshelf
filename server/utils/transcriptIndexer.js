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
 * Index a transcript from a file on disk
 *
 * @param {string} libraryItemId
 * @param {string} title
 * @param {string} filePath - absolute path to transcript.txt
 */
async function indexTranscriptFromFile(libraryItemId, title, filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8')
    if (text && text.trim()) {
      await indexTranscript(libraryItemId, title, text.trim())
      return true
    }
  } catch (error) {
    Logger.error(`${loggerPrefix} Failed to read transcript file "${filePath}"`, error)
  }
  return false
}

/**
 * Re-index all transcripts in the database.
 * Queries all library items that have a transcript.txt in their libraryFiles,
 * reads each file from disk, and inserts into the FTS table.
 */
async function reindexAll() {
  Logger.info(`${loggerPrefix} Starting full transcript re-index`)

  // Find all library items that have a transcript.txt file
  const [rows] = await Database.sequelize.query(`
    SELECT li.id, li.title, json_extract(jf.value, '$.metadata.path') AS transcriptPath
    FROM libraryItems li, json_each(li.libraryFiles) AS jf
    WHERE json_valid(li.libraryFiles)
      AND json_extract(jf.value, '$.metadata.filename') = 'transcript.txt'
  `)

  if (!rows.length) {
    Logger.info(`${loggerPrefix} No transcript.txt files found in any library items`)
    return 0
  }

  Logger.info(`${loggerPrefix} Found ${rows.length} library items with transcript.txt`)

  // Clear existing FTS data
  await Database.sequelize.query('DELETE FROM transcriptsFts')

  let indexed = 0
  for (const row of rows) {
    const success = await indexTranscriptFromFile(row.id, row.title, row.transcriptPath)
    if (success) indexed++
  }

  Logger.info(`${loggerPrefix} Re-indexed ${indexed}/${rows.length} transcripts`)
  return indexed
}

/**
 * Check if the FTS table is empty and run reindexAll if so.
 * Called after migrations complete.
 */
async function reindexIfEmpty() {
  try {
    const [results] = await Database.sequelize.query('SELECT count(*) AS cnt FROM transcriptsFts')
    if (results[0].cnt === 0) {
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
  reindexAll,
  reindexIfEmpty
}
