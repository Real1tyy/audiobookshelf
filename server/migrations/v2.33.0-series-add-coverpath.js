/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-series-add-coverpath`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the coverPath column to the series table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('series')) {
    const tableDescription = await queryInterface.describeTable('series')
    if (!tableDescription.coverPath) {
      logger.info(`${loggerPrefix} Adding coverPath column to series table`)
      await queryInterface.addColumn('series', 'coverPath', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added coverPath column to series table`)
    } else {
      logger.info(`${loggerPrefix} coverPath column already exists in series table`)
    }
  } else {
    logger.info(`${loggerPrefix} series table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the coverPath column from the series table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('series')) {
    const tableDescription = await queryInterface.describeTable('series')
    if (tableDescription.coverPath) {
      logger.info(`${loggerPrefix} Removing coverPath column from series table`)
      await queryInterface.removeColumn('series', 'coverPath')
      logger.info(`${loggerPrefix} Removed coverPath column from series table`)
    } else {
      logger.info(`${loggerPrefix} coverPath column does not exist in series table`)
    }
  } else {
    logger.info(`${loggerPrefix} series table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
