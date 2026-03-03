import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from 'sequelize'

interface ClientCustomMetadataProvider {
  id: string
  name: string
  mediaType: string
  slug: string
}

class CustomMetadataProvider extends Model<InferAttributes<CustomMetadataProvider>, InferCreationAttributes<CustomMetadataProvider>> {
  declare id: CreationOptional<string>
  declare mediaType: string
  declare name: string
  declare url: string
  declare authHeaderValue: CreationOptional<string | null>
  declare extraData: CreationOptional<Record<string, unknown> | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  /**
   * Get providers for client by media type.
   * Currently only available for "book" media type.
   */
  static async getForClientByMediaType(mediaType: string): Promise<ClientCustomMetadataProvider[]> {
    if (mediaType !== 'book') return []
    const customMetadataProviders = await this.findAll({
      where: {
        mediaType
      }
    })
    return customMetadataProviders.map((cmp) => cmp.toClientJson())
  }

  /**
   * Check if provider exists by slug
   */
  static async checkExistsBySlug(providerSlug: string): Promise<boolean> {
    const providerId = providerSlug?.split?.('custom-')[1]
    if (!providerId) return false

    return (await this.count({ where: { id: providerId } })) > 0
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
        mediaType: DataTypes.STRING,
        url: DataTypes.STRING,
        authHeaderValue: DataTypes.STRING,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'customMetadataProvider'
      }
    )
  }

  getSlug(): string {
    return `custom-${this.id}`
  }

  toClientJson(): ClientCustomMetadataProvider {
    return {
      id: this.id,
      name: this.name,
      mediaType: this.mediaType,
      slug: this.getSlug()
    }
  }
}

export = CustomMetadataProvider
