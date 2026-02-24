/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.40.0'
const migrationName = `${migrationVersion}-book-add-transcript`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration adds a transcript TEXT column to the books table
 * so transcript content is persistently stored and can be re-indexed into FTS.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Check if column already exists
  const tableDescription = await queryInterface.describeTable('books')
  if (tableDescription.transcript) {
    logger.info(`${loggerPrefix} Column transcript already exists on books table`)
  } else {
    logger.info(`${loggerPrefix} Adding transcript column to books table`)
    await queryInterface.sequelize.query('ALTER TABLE books ADD COLUMN transcript TEXT DEFAULT NULL')
    logger.info(`${loggerPrefix} Added transcript column to books table`)
  }

  // Backfill: read transcript.txt content from disk into the new column
  // for any library items that have a transcript.txt file
  const [rows] = await queryInterface.sequelize.query(`
    SELECT li.mediaId AS bookId, json_extract(jf.value, '$.metadata.path') AS transcriptPath
    FROM libraryItems li, json_each(li.libraryFiles) AS jf
    WHERE json_valid(li.libraryFiles)
      AND json_extract(jf.value, '$.metadata.filename') = 'transcript.txt'
      AND li.mediaType = 'book'
  `)

  if (rows.length) {
    logger.info(`${loggerPrefix} Backfilling transcript column for ${rows.length} books from transcript.txt files`)
    const fs = require('fs')
    let backfilled = 0
    for (const row of rows) {
      try {
        const text = fs.readFileSync(row.transcriptPath, 'utf8')
        if (text && text.trim()) {
          await queryInterface.sequelize.query('UPDATE books SET transcript = :transcript WHERE id = :bookId', {
            replacements: { transcript: text.trim(), bookId: row.bookId }
          })
          backfilled++
        }
      } catch (err) {
        logger.warn(`${loggerPrefix} Failed to read transcript file "${row.transcriptPath}": ${err.message}`)
      }
    }
    logger.info(`${loggerPrefix} Backfilled ${backfilled}/${rows.length} books with transcript content`)
  }

  // Also backfill from existing FTS entries (for virtual items that had transcripts indexed)
  const [ftsRows] = await queryInterface.sequelize.query(`
    SELECT f.libraryItemId, f.transcriptText
    FROM transcriptsFts f
    JOIN libraryItems li ON li.id = f.libraryItemId
    JOIN books b ON b.id = li.mediaId
    WHERE b.transcript IS NULL
      AND f.transcriptText IS NOT NULL
      AND f.transcriptText != ''
  `)

  if (ftsRows.length) {
    logger.info(`${loggerPrefix} Backfilling ${ftsRows.length} books from existing FTS entries`)
    for (const row of ftsRows) {
      await queryInterface.sequelize.query(`
        UPDATE books SET transcript = :transcript
        WHERE id = (SELECT mediaId FROM libraryItems WHERE id = :libraryItemId)
      `, {
        replacements: { transcript: row.transcriptText, libraryItemId: row.libraryItemId }
      })
    }
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // SQLite doesn't support DROP COLUMN directly in older versions,
  // but Sequelize's queryInterface handles it
  const tableDescription = await queryInterface.describeTable('books')
  if (tableDescription.transcript) {
    await queryInterface.removeColumn('books', 'transcript')
    logger.info(`${loggerPrefix} Removed transcript column from books table`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
