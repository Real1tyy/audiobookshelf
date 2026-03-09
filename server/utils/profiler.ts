import { performance, createHistogram, RecordableHistogram } from 'perf_hooks'
import util from 'util'
const Logger = require('../Logger')

type HistogramWithValues = RecordableHistogram & { values: number[] }

const histograms = new Map<string, HistogramWithValues>()

function profile<T extends (...args: any[]) => Promise<any>>(
  asyncFunc: T,
  isFindQuery = true,
  funcName = asyncFunc.name
): (...args: Parameters<T>) => ReturnType<T> {
  if (!histograms.has(funcName)) {
    const histogram = createHistogram() as HistogramWithValues
    histogram.values = []
    histograms.set(funcName, histogram)
  }
  const histogram = histograms.get(funcName)!

  return (async (...args: Parameters<T>) => {
    if (isFindQuery) {
      const findOptions = args[0]
      Logger.info(`[${funcName}] findOptions:`, util.inspect(findOptions, { depth: null }))
      findOptions.logging = (query: string, time: number) => Logger.info(`[${funcName}] ${query} Elapsed time: ${time}ms`)
      findOptions.benchmark = true
    }
    const start = performance.now()
    try {
      const result = await asyncFunc(...args)
      return result
    } catch (error) {
      Logger.error(`[${funcName}] failed`)
      throw error
    } finally {
      const end = performance.now()
      const duration = Math.round(end - start)
      histogram.record(duration)
      histogram.values.push(duration)
      Logger.info(`[${funcName}] duration: ${duration}ms`)
      Logger.info(`[${funcName}] histogram values:`, histogram.values)
      Logger.info(`[${funcName}] histogram:`, histogram)
    }
  }) as (...args: Parameters<T>) => ReturnType<T>
}

module.exports = { profile }
