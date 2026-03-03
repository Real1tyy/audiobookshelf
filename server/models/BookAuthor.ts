import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, Sequelize } from 'sequelize'

class BookAuthor extends Model<InferAttributes<BookAuthor>, InferCreationAttributes<BookAuthor>> {
  declare id: CreationOptional<string>
  declare bookId: ForeignKey<string>
  declare authorId: ForeignKey<string>
  declare createdAt: CreationOptional<Date>

  static removeByIds(authorId: string | null = null, bookId: string | null = null) {
    const where: Record<string, string> = {}
    if (authorId) where.authorId = authorId
    if (bookId) where.bookId = bookId
    return this.destroy({
      where
    })
  }

  /**
   * Get number of books for author
   */
  static getCountForAuthor(authorId: string): Promise<number> {
    return this.count({
      where: {
        authorId
      }
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
        }
      },
      {
        sequelize,
        modelName: 'bookAuthor',
        timestamps: true,
        updatedAt: false,
        indexes: [
          {
            name: 'bookAuthor_authorId',
            fields: ['authorId']
          }
        ]
      }
    )

    // Super Many-to-Many
    // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
    const { book, author } = sequelize.models
    book.belongsToMany(author, { through: BookAuthor })
    author.belongsToMany(book, { through: BookAuthor })

    book.hasMany(BookAuthor, {
      onDelete: 'CASCADE'
    })
    BookAuthor.belongsTo(book)

    author.hasMany(BookAuthor, {
      onDelete: 'CASCADE'
    })
    BookAuthor.belongsTo(author)
  }
}

export = BookAuthor
