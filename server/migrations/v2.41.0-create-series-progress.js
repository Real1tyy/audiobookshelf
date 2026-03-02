/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.41.0'
const migrationName = `${migrationVersion}-create-series-progress`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration creates the seriesProgresses table for tracking
 * a user's playback position within a series across books.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Check if table already exists
  const tables = await queryInterface.showAllTables()
  if (tables.includes('seriesProgresses')) {
    logger.info(`${loggerPrefix} Table seriesProgresses already exists`)
    logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
    return
  }

  logger.info(`${loggerPrefix} Creating seriesProgresses table`)
  await queryInterface.sequelize.query(`
    CREATE TABLE seriesProgresses (
      id UUID PRIMARY KEY NOT NULL,
      currentBookId UUID,
      currentTime FLOAT DEFAULT 0,
      currentBookIndex INTEGER DEFAULT 0,
      isFinished BOOLEAN DEFAULT 0,
      lastPlayedAt DATETIME,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      userId UUID REFERENCES users(id) ON DELETE CASCADE,
      seriesId UUID REFERENCES series(id) ON DELETE CASCADE
    )
  `)

  // Unique index on (userId, seriesId)
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX seriesProgresses_userId_seriesId ON seriesProgresses (userId, seriesId)
  `)

  // Index on lastPlayedAt for sorting
  await queryInterface.sequelize.query(`
    CREATE INDEX seriesProgresses_lastPlayedAt ON seriesProgresses (lastPlayedAt)
  `)

  logger.info(`${loggerPrefix} Created seriesProgresses table with indexes`)
  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  const tables = await queryInterface.showAllTables()
  if (tables.includes('seriesProgresses')) {
    await queryInterface.sequelize.query('DROP TABLE seriesProgresses')
    logger.info(`${loggerPrefix} Dropped seriesProgresses table`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
