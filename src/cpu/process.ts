import { log } from "utils/log";

export const PROCESS_PRIORITY_HIGHT = 10;
export const PROCESS_PRIORITY_NORMAL = 100;
export const PROCESS_PRIORITY_LOW = 1000;

export interface Process {
  pid: number;
  createdAt: number;
  priority: number;
  runnable: () => void;
}

export class ProcessStack {

  private static _nextPid: number;

  private _processQueue: Process[];

  private _totalTime: number;

  constructor() {
    this._processQueue = [];
    this._totalTime = 0
  }

  private get nextPid() {
    return ++ProcessStack._nextPid;
  }

  get totalTime(): number {
    return this._totalTime;
  }

  get empty(): boolean {
    return this._processQueue.length == 0;
  }

  clean(): void {
    this._processQueue = [];
  }

  public pushProcess(runnable: () => void, priority: number = PROCESS_PRIORITY_NORMAL) {
    this._processQueue.push({
      pid: this.nextPid,
      createdAt: Game.time,
      priority: priority,
      runnable: runnable
    } as Process);
  }

  nextProcess() {
    return this._processQueue.shift();
  }

  runNextProcess() {

    if (this.empty) {
      return;
    }

    const process = this.nextProcess();

    if (process) {
      const start = Game.cpu.getUsed();
      try {
        process.runnable();
      } catch (err: any) {
        log.fatal(err);
        log.fatal(err.stack);
      }

      const taskCpuUse = start - Game.cpu.getUsed();

      this._totalTime += taskCpuUse;

    }

  }

}