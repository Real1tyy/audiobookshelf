/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.39.0'
const migrationName = `${migrationVersion}-book-url-to-json`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration converts the url column from STRING to JSON and migrates
 * existing string URL values to single-element arrays.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')

    if (tableDescription.url) {
      // SQLite doesn't support ALTER COLUMN, so we need to:
      // 1. Read existing data
      // 2. Convert string values to JSON arrays
      // The column type in SQLite is flexible, so we just need to update the data
      logger.info(`${loggerPrefix} Migrating existing url values to JSON arrays`)

      const books = await queryInterface.sequelize.query('SELECT id, url FROM books WHERE url IS NOT NULL AND url != ""', {
        type: queryInterface.sequelize.Sequelize.QueryTypes.SELECT
      })

      let migratedCount = 0
      for (const book of books) {
        let newValue
        try {
          // Check if already a JSON array
          const parsed = JSON.parse(book.url)
          if (Array.isArray(parsed)) {
            continue // Already migrated
          }
          // If it's some other JSON value, wrap in array
          newValue = JSON.stringify([String(parsed)])
        } catch {
          // Plain string URL - wrap in array
          newValue = JSON.stringify([book.url])
        }

        await queryInterface.sequelize.query('UPDATE books SET url = :newValue WHERE id = :id', {
          replacements: { newValue, id: book.id }
        })
        migratedCount++
      }

      logger.info(`${loggerPrefix} Migrated ${migratedCount} url values to JSON arrays`)
    } else {
      logger.info(`${loggerPrefix} url column does not exist in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration converts url JSON arrays back to plain string values (first element).
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')

    if (tableDescription.url) {
      logger.info(`${loggerPrefix} Converting url JSON arrays back to strings`)

      const books = await queryInterface.sequelize.query('SELECT id, url FROM books WHERE url IS NOT NULL AND url != ""', {
        type: queryInterface.sequelize.Sequelize.QueryTypes.SELECT
      })

      let migratedCount = 0
      for (const book of books) {
        try {
          const parsed = JSON.parse(book.url)
          if (Array.isArray(parsed)) {
            const firstUrl = parsed[0] || null
            await queryInterface.sequelize.query('UPDATE books SET url = :newValue WHERE id = :id', {
              replacements: { newValue: firstUrl, id: book.id }
            })
            migratedCount++
          }
        } catch {
          // Already a plain string, skip
        }
      }

      logger.info(`${loggerPrefix} Converted ${migratedCount} url values back to strings`)
    } else {
      logger.info(`${loggerPrefix} url column does not exist in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
