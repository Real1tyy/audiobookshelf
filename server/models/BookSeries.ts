import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, Sequelize } from 'sequelize'

class BookSeries extends Model<InferAttributes<BookSeries>, InferCreationAttributes<BookSeries>> {
  declare id: CreationOptional<string>
  declare sequence: CreationOptional<string | null>
  declare bookId: ForeignKey<string>
  declare seriesId: ForeignKey<string>
  declare createdAt: CreationOptional<Date>

  static removeByIds(seriesId: string | null = null, bookId: string | null = null) {
    const where: Record<string, string> = {}
    if (seriesId) where.seriesId = seriesId
    if (bookId) where.bookId = bookId
    return this.destroy({
      where
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
        sequence: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'bookSeries',
        timestamps: true,
        updatedAt: false,
        indexes: [
          {
            name: 'bookSeries_seriesId',
            fields: ['seriesId']
          }
        ]
      }
    )

    // Super Many-to-Many
    // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
    const { book, series } = sequelize.models
    book.belongsToMany(series, { through: BookSeries })
    series.belongsToMany(book, { through: BookSeries })

    book.hasMany(BookSeries, {
      onDelete: 'CASCADE'
    })
    BookSeries.belongsTo(book)

    series.hasMany(BookSeries, {
      onDelete: 'CASCADE'
    })
    BookSeries.belongsTo(series)
  }
}

export = BookSeries
