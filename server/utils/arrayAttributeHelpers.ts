const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

interface RenameResult {
  merged: boolean
  numItemsUpdated: number
}

interface DeleteResult {
  numItemsUpdated: number
}

interface AttributeConfig {
  field: 'tags' | 'genres'
  getAllItemsWith: (values: string[]) => Promise<any[]>
  replaceInFilterData: (oldVal: string, newVal: string) => void
  removeFromFilterData: (val: string) => void
}

async function renameArrayAttribute(config: AttributeConfig, oldValue: string, newValue: string): Promise<RenameResult> {
  let merged = false
  let numItemsUpdated = 0

  config.replaceInFilterData(oldValue, newValue)

  const libraryItems = await config.getAllItemsWith([oldValue, newValue])
  for (const libraryItem of libraryItems) {
    if (libraryItem.media[config.field].includes(newValue)) {
      merged = true
    }

    if (libraryItem.media[config.field].includes(oldValue)) {
      libraryItem.media[config.field] = libraryItem.media[config.field].filter((v: string) => v !== oldValue)
      if (!libraryItem.media[config.field].includes(newValue)) {
        libraryItem.media[config.field].push(newValue)
      }
      Logger.debug(`[arrayAttributeHelpers] Rename ${config.field} "${oldValue}" to "${newValue}" for item "${libraryItem.media.title}"`)
      await libraryItem.media.update({
        [config.field]: libraryItem.media[config.field]
      })
      await libraryItem.saveMetadataFile()

      SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
      numItemsUpdated++
    }
  }

  return { merged, numItemsUpdated }
}

async function deleteArrayAttribute(config: AttributeConfig, value: string): Promise<DeleteResult> {
  let numItemsUpdated = 0

  config.removeFromFilterData(value)

  const libraryItems = await config.getAllItemsWith([value])
  for (const libraryItem of libraryItems) {
    Logger.debug(`[arrayAttributeHelpers] Remove ${config.field} "${value}" from item "${libraryItem.media.title}"`)
    libraryItem.media[config.field] = libraryItem.media[config.field].filter((v: string) => v !== value)
    await libraryItem.media.update({
      [config.field]: libraryItem.media[config.field]
    })
    await libraryItem.saveMetadataFile()

    SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
    numItemsUpdated++
  }

  return { numItemsUpdated }
}

module.exports = { renameArrayAttribute, deleteArrayAttribute }
