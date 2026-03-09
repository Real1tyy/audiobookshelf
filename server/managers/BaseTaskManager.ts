const Logger = require('../Logger')
const TaskManager = require('./TaskManager')

/**
 * Base class for managers that run tasks with a concurrency-limited queue.
 * Subclasses must implement `runTask(task)` and can override `onTaskFinished(task)`.
 */
class BaseTaskManager {
  protected managerName: string
  protected maxConcurrentTasks: number
  protected tasksRunning: any[]
  protected tasksQueued: any[]

  constructor(managerName: string, maxConcurrentTasks: number = 1) {
    this.managerName = managerName
    this.maxConcurrentTasks = maxConcurrentTasks
    this.tasksRunning = []
    this.tasksQueued = []
  }

  getIsLibraryItemQueuedOrProcessing(libraryItemId: string): boolean {
    return (
      this.tasksQueued.some((t: any) => t.data.libraryItemId === libraryItemId) ||
      this.tasksRunning.some((t: any) => t.data.libraryItemId === libraryItemId)
    )
  }

  getQueuedTaskData(): any[] {
    return this.tasksQueued.map((t: any) => t.data)
  }

  /**
   * Enqueue or immediately run a task.
   * Returns true if the task was queued (not started immediately).
   */
  protected enqueueTask(task: any, description?: string): boolean {
    if (this.tasksRunning.length >= this.maxConcurrentTasks) {
      Logger.info(`[${this.managerName}] Queueing task: ${description || task.id}`)
      this.tasksQueued.push(task)
      return true
    }
    this.runTask(task)
    return false
  }

  /**
   * Subclasses must implement this to execute the task.
   * Call `this.handleTaskFinished(task)` when done.
   */
  protected runTask(_task: any): void {
    throw new Error(`[${this.managerName}] runTask() must be implemented by subclass`)
  }

  /**
   * Start tracking a task and register it with the global TaskManager.
   * Call at the beginning of runTask().
   */
  protected startTask(task: any): void {
    this.tasksRunning.push(task)
    TaskManager.addTask(task)
  }

  /**
   * Mark a task as finished, remove from running, and dequeue the next task.
   * Subclasses can override `onTaskDequeued(task)` for custom dequeue behavior.
   */
  protected handleTaskFinished(task: any): void {
    TaskManager.taskFinished(task)
    this.tasksRunning = this.tasksRunning.filter((t: any) => t.id !== task.id)

    if (this.tasksRunning.length < this.maxConcurrentTasks && this.tasksQueued.length) {
      Logger.info(`[${this.managerName}] Task finished, dequeueing next task. ${this.tasksQueued.length} tasks queued.`)
      const nextTask = this.tasksQueued.shift()
      this.onTaskDequeued(nextTask)
      this.runTask(nextTask)
    }
  }

  /**
   * Hook called when a task is dequeued. Override for custom behavior (e.g. socket events).
   */
  protected onTaskDequeued(_task: any): void {
    // No-op by default
  }
}

export = BaseTaskManager
