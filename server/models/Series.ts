import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey, NonAttribute, Sequelize, where, fn, col, literal } from 'sequelize'

const { getTitlePrefixAtEnd, getTitleIgnorePrefix } = require('../utils/index')

class Series extends Model<InferAttributes<Series>, InferCreationAttributes<Series>> {
  declare id: CreationOptional<string>
  declare name: string
  declare nameIgnorePrefix: string | null
  declare description: string | null
  declare coverPath: string | null
  declare libraryId: ForeignKey<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Expanded properties
  declare books?: NonAttribute<any[]>

  static async checkExistsById(seriesId: string): Promise<boolean> {
    return (await this.count({ where: { id: seriesId } })) > 0
  }

  static async getByNameAndLibrary(seriesName: string, libraryId: string) {
    return this.findOne({
      where: [
        where(fn('lower', col('name')), seriesName.toLowerCase()),
        {
          libraryId
        }
      ]
    })
  }

  static async getExpandedById(seriesId: string) {
    const series = await this.findByPk(seriesId)
    if (!series) return null
    series.books = await (series as any).getBooksExpandedWithLibraryItem()
    return series
  }

  static async findOrCreateByNameAndLibrary(seriesName: string, libraryId: string) {
    const series = await this.getByNameAndLibrary(seriesName, libraryId)
    if (series) return series
    return this.create({
      name: seriesName,
      nameIgnorePrefix: getTitleIgnorePrefix(seriesName),
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
        nameIgnorePrefix: DataTypes.STRING,
        description: DataTypes.TEXT,
        coverPath: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'series',
        indexes: [
          {
            fields: [
              {
                name: 'name',
                collate: 'NOCASE'
              }
            ]
          },
          {
            fields: ['name', 'libraryId'],
            unique: true,
            name: 'unique_series_name_per_library'
          },
          {
            fields: ['libraryId']
          }
        ]
      }
    )

    const { library } = sequelize.models
    library.hasMany(Series, {
      onDelete: 'CASCADE'
    })
    Series.belongsTo(library)
  }

  getBooksExpandedWithLibraryItem() {
    return (this as any).getBooks({
      joinTableAttributes: ['sequence'],
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
      ],
      order: [[literal('CAST(`bookSeries.sequence` AS FLOAT) ASC NULLS LAST')]]
    })
  }

  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      nameIgnorePrefix: getTitlePrefixAtEnd(this.name),
      description: this.description,
      coverPath: this.coverPath,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      libraryId: this.libraryId
    }
  }

  toJSONMinimal(sequence: string) {
    return {
      id: this.id,
      name: this.name,
      sequence
    }
  }
}

export = Series
