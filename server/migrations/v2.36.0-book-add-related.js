/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.36.0'
const migrationName = `${migrationVersion}-book-add-related`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the relatedBooks column to the books table.
 * Related books is a JSON array of book IDs that are related to this book.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')
    if (!tableDescription.relatedBooks) {
      logger.info(`${loggerPrefix} Adding relatedBooks column to books table`)
      await queryInterface.addColumn('books', 'relatedBooks', {
        type: queryInterface.sequelize.Sequelize.DataTypes.JSON,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added relatedBooks column to books table`)
    } else {
      logger.info(`${loggerPrefix} relatedBooks column already exists in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the relatedBooks column from the books table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')
    if (tableDescription.relatedBooks) {
      logger.info(`${loggerPrefix} Removing relatedBooks column from books table`)
      await queryInterface.removeColumn('books', 'relatedBooks')
      logger.info(`${loggerPrefix} Removed relatedBooks column from books table`)
    } else {
      logger.info(`${loggerPrefix} relatedBooks column does not exist in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
