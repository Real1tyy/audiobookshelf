import { z, ZodObject, ZodRawShape } from 'zod'

/**
 * Deep equality check for plain values (primitives, arrays, plain objects).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((val, i) => deepEqual(val, b[i]))
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>)
    const keysB = Object.keys(b as Record<string, unknown>)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) => deepEqual((a as any)[key], (b as any)[key]))
  }

  return false
}

/**
 * Compare target with payload using schema keys. Returns merged data and whether updates occurred.
 */
export function applyUpdate<S extends ZodObject<ZodRawShape>>(
  schema: S,
  target: Record<string, any>,
  payload: Record<string, any>,
  options: { ignoreKeys?: string[] } = {}
): { data: Record<string, any>; hasUpdates: boolean } {
  const { ignoreKeys = [] } = options
  let hasUpdates = false
  const result = { ...target }

  for (const key of Object.keys(schema.shape)) {
    if (ignoreKeys.includes(key)) continue
    if (payload[key] === undefined) continue

    if (!deepEqual(target[key], payload[key])) {
      result[key] = structuredClone(payload[key])
      hasUpdates = true
    }
  }

  return { data: result, hasUpdates }
}

/**
 * Factory that creates a base class from a Zod schema.
 * Provides constructor(data?), toJSON(), clone(), and update() automatically.
 */
export function createZodClass<S extends ZodObject<ZodRawShape>>(schema: S) {
  class ZodClass {
    static schema = schema

    constructor(data?: any) {
      const parsed = schema.parse(data ?? {})
      Object.assign(this, parsed)
    }

    toJSON(): any {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(schema.shape)) {
        const val = (this as any)[key]
        if (val != null && typeof val === 'object' && typeof val.toJSON === 'function') {
          result[key] = val.toJSON()
        } else if (Array.isArray(val)) {
          result[key] = val.map((item: any) =>
            item != null && typeof item === 'object' && typeof item.toJSON === 'function'
              ? item.toJSON()
              : structuredClone(item)
          )
        } else {
          result[key] = val
        }
      }
      return result
    }

    clone(): any {
      return new (this.constructor as any)(this.toJSON())
    }

    update(payload: Record<string, any>, opts?: { ignoreKeys?: string[] }): boolean {
      const { data, hasUpdates } = applyUpdate(schema, this as any, payload, opts)
      if (hasUpdates) {
        Object.assign(this, data)
      }
      return hasUpdates
    }
  }

  return ZodClass as { new (data?: any): any; schema: S }
}
