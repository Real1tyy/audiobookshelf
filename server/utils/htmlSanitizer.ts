const sanitizeHtml: (dirty: string, options?: object) => string = require('sanitize-html')
const { entities }: { entities: Record<string, string> } = require('./htmlEntities')

function sanitize(html: string): string {
  if (typeof html !== 'string') {
    throw new Error('sanitizeHtml: input must be a string')
  }

  const sanitizerOptions = {
    allowedTags: ['p', 'ol', 'ul', 'li', 'a', 'strong', 'em', 'del', 'br', 'b', 'i'],
    disallowedTagsMode: 'discard',
    allowedAttributes: {
      a: ['href', 'name', 'target']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false
  }

  return sanitizeHtml(html, sanitizerOptions)
}

function stripAllTags(html: string, shouldDecodeEntities = true): string {
  const sanitizerOptions = {
    allowedTags: [] as string[],
    disallowedTagsMode: 'discard'
  }

  let sanitized = sanitizeHtml(html, sanitizerOptions)
  return shouldDecodeEntities ? decodeHTMLEntities(sanitized) : sanitized
}

function decodeHTMLEntities(strToDecode: string): string {
  return strToDecode.replace(/\&([^;]+);?/g, function (entity) {
    if (entity in entities) {
      return entities[entity]
    }
    return entity
  })
}

module.exports = { sanitize, stripAllTags }
