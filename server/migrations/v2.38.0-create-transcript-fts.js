/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.38.0'
const migrationName = `${migrationVersion}-create-transcript-fts`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration creates an FTS5 virtual table for full-text search of transcript content.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Check if the table already exists
  const [results] = await queryInterface.sequelize.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='transcriptsFts'`)
  if (results.length) {
    logger.info(`${loggerPrefix} transcriptsFts table already exists`)
  } else {
    logger.info(`${loggerPrefix} Creating transcriptsFts FTS5 virtual table`)
    await queryInterface.sequelize.query(`
      CREATE VIRTUAL TABLE transcriptsFts USING fts5(
        libraryItemId UNINDEXED,
        title UNINDEXED,
        transcriptText,
        tokenize='porter unicode61'
      )
    `)
    logger.info(`${loggerPrefix} Created transcriptsFts FTS5 virtual table`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration drops the transcriptsFts FTS5 virtual table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  logger.info(`${loggerPrefix} Dropping transcriptsFts table`)
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS transcriptsFts')
  logger.info(`${loggerPrefix} Dropped transcriptsFts table`)

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
