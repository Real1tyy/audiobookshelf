/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.35.0'
const migrationName = `${migrationVersion}-book-add-url`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the url column to the books table.
 * URL can be used to link to external resources (e.g., Goodreads, Amazon, etc.)
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')
    if (!tableDescription.url) {
      logger.info(`${loggerPrefix} Adding url column to books table`)
      await queryInterface.addColumn('books', 'url', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added url column to books table`)
    } else {
      logger.info(`${loggerPrefix} url column already exists in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the url column from the books table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')
    if (tableDescription.url) {
      logger.info(`${loggerPrefix} Removing url column from books table`)
      await queryInterface.removeColumn('books', 'url')
      logger.info(`${loggerPrefix} Removed url column from books table`)
    } else {
      logger.info(`${loggerPrefix} url column does not exist in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
