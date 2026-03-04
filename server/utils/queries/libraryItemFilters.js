const Sequelize = require('sequelize')
const Database = require('../../Database')
const libraryItemsBookFilters = require('./libraryItemsBookFilters')

module.exports = {
  /**
   * Get all library items that have tags
   * @param {string[]} tags
   * @returns {Promise<import('../../models/LibraryItem')[]>}
   */
  async getAllLibraryItemsWithTags(tags) {
    const libraryItems = []
    const booksWithTag = await Database.bookModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:tags))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        tags
      },
      include: [
        {
          model: Database.libraryItemModel
        },
        {
          model: Database.authorModel,
          through: {
            attributes: []
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['sequence']
          }
        }
      ],
      order: [
        [Database.authorModel, Database.bookAuthorModel, 'createdAt', 'ASC'],
        [Database.seriesModel, 'bookSeries', 'createdAt', 'ASC']
      ]
    })
    for (const book of booksWithTag) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Get all library items that have genres
   * @param {string[]} genres
   * @returns {Promise<import('../../models/LibraryItem')[]>}
   */
  async getAllLibraryItemsWithGenres(genres) {
    const libraryItems = []
    const booksWithGenre = await Database.bookModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(genres) WHERE json_valid(genres) AND json_each.value IN (:genres))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        genres
      },
      include: [
        {
          model: Database.libraryItemModel
        },
        {
          model: Database.authorModel,
          through: {
            attributes: []
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })
    for (const book of booksWithGenre) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Search library items
   * @param {import('../../models/User')} user
   * @param {import('../../models/Library')} library
   * @param {string} query
   * @param {number} limit
   * @returns {{book:object[], authors:object[], tags:object[], series:object[]}}
   */
  search(user, library, query, limit) {
    return libraryItemsBookFilters.search(user, library, query, limit, 0)
  },

  /**
   * Get largest items in library
   * @param {string} libraryId
   * @param {number} limit
   * @returns {Promise<{ id:string, title:string, size:number }[]>}
   */
  async getLargestItems(libraryId, limit) {
    const libraryItems = await Database.libraryItemModel.findAll({
      attributes: ['id', 'mediaId', 'mediaType', 'size'],
      where: {
        libraryId
      },
      include: [
        {
          model: Database.bookModel,
          attributes: ['id', 'title']
        }
      ],
      order: [['size', 'DESC']],
      limit
    })
    return libraryItems.map((libraryItem) => {
      return {
        id: libraryItem.id,
        title: libraryItem.media.title,
        size: libraryItem.size
      }
    })
  }
}
