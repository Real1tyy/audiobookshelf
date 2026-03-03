import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, NonAttribute, Sequelize, where, fn, col } from 'sequelize'

const parseNameString = require('../utils/parsers/parseNameString')

class Author extends Model<InferAttributes<Author, { omit: 'books' }>, InferCreationAttributes<Author, { omit: 'books' }>> {
  declare id: CreationOptional<string>
  declare name: string
  declare lastFirst: CreationOptional<string | null>
  declare asin: CreationOptional<string | null>
  declare description: CreationOptional<string | null>
  declare imagePath: CreationOptional<string | null>
  declare libraryId: ForeignKey<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties from associations
  declare books?: NonAttribute<any[]>

  static getLastFirst(name: string): string | null {
    if (!name) return null
    return parseNameString.nameToLastFirst(name)
  }

  /**
   * Check if author exists
   */
  static async checkExistsById(authorId: string): Promise<boolean> {
    return (await this.count({ where: { id: authorId } })) > 0
  }

  /**
   * Get author by name and libraryId. name case insensitive
   * TODO: Look for authors ignoring punctuation
   */
  static async getByNameAndLibrary(authorName: string, libraryId: string): Promise<Author | null> {
    return this.findOne({
      where: [
        where(fn('lower', col('name')), authorName.toLowerCase()),
        {
          libraryId
        }
      ]
    })
  }

  static async getAllLibraryItemsForAuthor(authorId: string) {
    const author = await this.findByPk(authorId, {
      include: [
        {
          model: this.sequelize!.models.book,
          include: [
            {
              model: this.sequelize!.models.libraryItem
            },
            {
              model: this.sequelize!.models.author,
              through: {
                attributes: []
              }
            },
            {
              model: this.sequelize!.models.series,
              through: {
                attributes: ['sequence']
              }
            }
          ]
        }
      ]
    })

    const libraryItems: any[] = []
    if (author?.books) {
      for (const book of author.books) {
        const libraryItem = (book as any).libraryItem
        libraryItem.media = book
        delete (book as any).libraryItem
        libraryItems.push(libraryItem)
      }
    }

    return libraryItems
  }

  static async findOrCreateByNameAndLibrary(name: string, libraryId: string): Promise<Author> {
    const author = await this.getByNameAndLibrary(name, libraryId)
    if (author) return author
    return this.create({
      name,
      lastFirst: this.getLastFirst(name),
      libraryId
    })
  }

  static init(...args: any[]): any {
    const sequelize = args[0] as Sequelize
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        lastFirst: DataTypes.STRING,
        asin: DataTypes.STRING,
        description: DataTypes.TEXT,
        imagePath: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'author',
        indexes: [
          {
            fields: [
              {
                name: 'name',
                collate: 'NOCASE'
              }
            ]
          },
          // {
          //   fields: [{
          //     name: 'lastFirst',
          //     collate: 'NOCASE'
          //   }]
          // },
          {
            fields: ['libraryId']
          }
        ]
      }
    )

    const { library } = sequelize.models
    library.hasMany(Author, {
      onDelete: 'CASCADE'
    })
    Author.belongsTo(library)
  }

  toOldJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      libraryId: this.libraryId,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    }
  }

  toOldJSONExpanded(numBooks: number = 0) {
    const oldJson = this.toOldJSON()
    return { ...oldJson, numBooks }
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }
}

export = Author
