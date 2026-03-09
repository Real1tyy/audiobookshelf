const date: { format(d: Date, p: string): string } = require('date-and-time')
const { LogLevel } = require('./utils/constants')
import util from 'util'

interface LogObject {
  timestamp: string
  source: string
  message: string
  levelName: string
  level: number
}

interface SocketListener {
  id: string
  socket: { emit(event: string, data: unknown): void }
  level: number
}

interface LogManager {
  logToFile(logObj: LogObject): Promise<void>
  getMostRecentCurrentDailyLogs(): unknown
}

class Logger {
  logManager: LogManager | null
  isDev: boolean
  logLevel: number
  socketListeners: SocketListener[]

  constructor() {
    this.logManager = null
    this.isDev = process.env.NODE_ENV !== 'production'
    this.logLevel = !this.isDev ? LogLevel.INFO : LogLevel.TRACE
    this.socketListeners = []
  }

  get timestamp(): string {
    return date.format(new Date(), 'YYYY-MM-DD HH:mm:ss.SSS')
  }

  get levelString(): string {
    return this.getLogLevelString(this.logLevel)
  }

  get source(): string {
    const regex = (global as any).isWin ? /^.*\\([^\\:]*:[0-9]*):[0-9]*\)*/ : /^.*\/([^/:]*:[0-9]*):[0-9]*\)*/
    return (Error().stack ?? '').split('\n')[3]?.replace(regex, '$1') ?? 'unknown'
  }

  getLogLevelString(level: number): string {
    for (const key in LogLevel) {
      if (LogLevel[key] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addSocketListener(socket: { id: string; emit(event: string, data: unknown): void }, level: number): void {
    var index = this.socketListeners.findIndex((s) => s.id === socket.id)
    if (index >= 0) {
      this.socketListeners.splice(index, 1, {
        id: socket.id,
        socket,
        level
      })
    } else {
      this.socketListeners.push({
        id: socket.id,
        socket,
        level
      })
    }
  }

  removeSocketListener(socketId: string): void {
    this.socketListeners = this.socketListeners.filter((s) => s.id !== socketId)
  }

  async #logToFileAndListeners(level: number, levelName: string, args: unknown[], src: string): Promise<void> {
    const expandedArgs = args.map((arg) => (typeof arg !== 'string' ? util.inspect(arg) : arg))
    const logObj: LogObject = {
      timestamp: this.timestamp,
      source: src,
      message: expandedArgs.join(' '),
      levelName,
      level
    }

    // Emit log to sockets that are listening to log events
    this.socketListeners.forEach((socketListener) => {
      if (level >= LogLevel.FATAL || level >= socketListener.level) {
        socketListener.socket.emit('log', logObj)
      }
    })

    // Save log to file
    if (level >= LogLevel.FATAL || level >= this.logLevel) {
      await this.logManager?.logToFile(logObj)
    }
  }

  setLogLevel(level: number): void {
    this.logLevel = level
    this.debug(`Set Log Level to ${this.levelString}`)
  }

  static ConsoleMethods: Record<string, string> = {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'error',
    NOTE: 'log'
  }

  #log(levelName: string, source: string, ...args: unknown[]): void {
    const level = LogLevel[levelName]
    if (level < LogLevel.FATAL && level < this.logLevel) return
    const consoleMethod = Logger.ConsoleMethods[levelName] as keyof Console
    ;(console[consoleMethod] as Function)(`[${this.timestamp}] ${levelName}:`, ...args)
    this.#logToFileAndListeners(level, levelName, args, source)
  }

  trace(...args: unknown[]): void {
    this.#log('TRACE', this.source, ...args)
  }

  debug(...args: unknown[]): void {
    this.#log('DEBUG', this.source, ...args)
  }

  info(...args: unknown[]): void {
    this.#log('INFO', this.source, ...args)
  }

  warn(...args: unknown[]): void {
    this.#log('WARN', this.source, ...args)
  }

  error(...args: unknown[]): void {
    this.#log('ERROR', this.source, ...args)
  }

  fatal(...args: unknown[]): void {
    this.#log('FATAL', this.source, ...args)
  }

  note(...args: unknown[]): void {
    this.#log('NOTE', this.source, ...args)
  }
}
export = new Logger()
