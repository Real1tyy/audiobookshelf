/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.37.0'
const migrationName = `${migrationVersion}-book-add-stats`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds viewedCount and totalListeningTime columns to the books table.
 * viewedCount tracks how many times a book has been completed.
 * totalListeningTime tracks total minutes listened across all sessions.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')

    if (!tableDescription.viewedCount) {
      logger.info(`${loggerPrefix} Adding viewedCount column to books table`)
      await queryInterface.addColumn('books', 'viewedCount', {
        type: queryInterface.sequelize.Sequelize.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      })
      logger.info(`${loggerPrefix} Added viewedCount column to books table`)
    } else {
      logger.info(`${loggerPrefix} viewedCount column already exists in books table`)
    }

    if (!tableDescription.totalListeningTime) {
      logger.info(`${loggerPrefix} Adding totalListeningTime column to books table`)
      await queryInterface.addColumn('books', 'totalListeningTime', {
        type: queryInterface.sequelize.Sequelize.DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      })
      logger.info(`${loggerPrefix} Added totalListeningTime column to books table`)
    } else {
      logger.info(`${loggerPrefix} totalListeningTime column already exists in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes viewedCount and totalListeningTime columns from the books table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')

    if (tableDescription.viewedCount) {
      logger.info(`${loggerPrefix} Removing viewedCount column from books table`)
      await queryInterface.removeColumn('books', 'viewedCount')
      logger.info(`${loggerPrefix} Removed viewedCount column from books table`)
    } else {
      logger.info(`${loggerPrefix} viewedCount column does not exist in books table`)
    }

    if (tableDescription.totalListeningTime) {
      logger.info(`${loggerPrefix} Removing totalListeningTime column from books table`)
      await queryInterface.removeColumn('books', 'totalListeningTime')
      logger.info(`${loggerPrefix} Removed totalListeningTime column from books table`)
    } else {
      logger.info(`${loggerPrefix} totalListeningTime column does not exist in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
