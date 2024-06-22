import _ from "lodash";
import { log } from "utils/log";
import { PROCESS_PRIORITY_NORMAL, Process } from "./process";
import { Settings } from "settings";
import { Scheduler } from "./scheduler";

export class CPU {

  static instance: CPU = new CPU();

  private _nextPid: number;
  // private processQueue: Process[];

  private limitMode: boolean;

  private constructor() {
    this._nextPid = 0;
    // this.processQueue = [];
    this.limitMode = false;
  }

  private get nextPid() {
    return ++this._nextPid;
  }

  static shouldRun(): boolean {
    let result = true;
    if (Game.cpu.bucket < Settings.cpuBucketMin) {
      console.log(`CPU bucket is too low (${Game.cpu.bucket}). Postponing operation until bucket reaches 500.`);
      result = false;
    }
    return result;
  }

  static cpu(): CPU {
    return CPU.instance;
  }

  /*
  static pushProcess(runnable: () => void, priority: number = PROCESS_PRIORITY_NORMAL) {
    CPU.instance.pushProcess(runnable, priority);
  }

  public clean() {
    this.processQueue = [];
  }

  public pushProcess(runnable: () => void, priority: number = PROCESS_PRIORITY_NORMAL) {
    this.processQueue.push({
      pid: this.nextPid,
      createdAt: Game.time,
      priority: priority,
      runnable: runnable
    } as Process);
  }
  */

  /*
  runNextProcess() {

    
    if (this.processQueue.length == 0) {
      return;
    }

    const process = this.processQueue.shift();
    if (process) {

      try {
        process.runnable();
      } catch (err: any) {
        log.fatal(err);
        log.fatal(err.stack);
      }

    }

  }
  */



  run(scheduler: Scheduler): void {

    if (Game.cpu.bucket < Settings.cpuLimitBucket && !(Memory as any).generatePixel) {
      this.limitMode = true;
    } else if (Game.cpu.bucket >= Settings.cpuUnlimitBucket) {
      this.limitMode = false;
    }

    const statistics = {
      total: 0,
      count: 0,
      min: 0,
      max: 0
    };

    let taskDropped = 0;

    let exec = scheduler.nextProcess();
    while (exec != null) {
      let start = Game.cpu.getUsed();
      try {
        exec.process.runnable();
      } catch (err: any) {
        log.fatal(err);
        log.fatal(err.stack);
      }
      const cpuUsed = Game.cpu.getUsed() - start;
      exec.group.totalTime += cpuUsed;

      statistics.total += cpuUsed;

      if (statistics.count == 0 || cpuUsed > statistics.max) {
        statistics.max = cpuUsed;
      }
      if (statistics.count == 0 || cpuUsed < statistics.min) {
        statistics.min = cpuUsed;
      }

      statistics.count++;

      if (this.limitMode && Game.cpu.getUsed() > Settings.cpuMax) {
        log.warning('Max CPU used reached');
        taskDropped += scheduler.taskCount();
        break;
      }

      if (exec.group.totalTime >= 25) {
        log.warning('Max CPU used for process group reached');
        taskDropped += scheduler.stopPreviousGroup();
      }

      exec = scheduler.nextProcess();

    }

    // Sanitaze

    statistics.total = Math.round((statistics.total + Number.EPSILON) * 100) / 100;
    const avg = Math.round(((statistics.total / Math.max(1, statistics.count)) + Number.EPSILON) * 100) / 100;
    const costByCreep = Math.round((statistics.total / Math.max(1, Object.keys(Game.creeps).length) + Number.EPSILON) * 100) / 100;

    log.info(`[${Game.time}] bucket: ${Game.cpu.bucket}, CPU used: ${statistics.total}, tasks: ${statistics.count}, avg: ${avg}, byCreeps: ${costByCreep}, taskDropped: ${taskDropped} `);

  }

  /*
  public run() {

    if (Game.cpu.bucket < 9000) {
      this.limitMode = true;
    } else if (Game.cpu.bucket >= 10000) {
      this.limitMode = false;
    }

    
    let taskCount = 0;

    this.processQueue.sort((p1, p2) => p1.priority - p2.priority);

    const statistics = {
      total: 0,
      count: 0,
      min: 0,
      max: 0
    };

    let lastCpu = Game.cpu.getUsed();

    let process = this.processQueue.shift();
    while (process != undefined) {
      try {
        process.runnable();
      } catch (err: any) {
        log.fatal(err);
        log.fatal(err.stack);
      }
      taskCount++;
      process = this.processQueue.shift();

      const currentCpu = Game.cpu.getUsed();
      const taskCpuUse = currentCpu - lastCpu;
      lastCpu = currentCpu;

      statistics.total += taskCpuUse;

      if (statistics.count == 0 || taskCpuUse > statistics.max) {
        statistics.max = taskCpuUse;
      }
      if (statistics.count == 0 || taskCpuUse < statistics.min) {
        statistics.min = taskCpuUse;
      }

      statistics.count++;

      if (this.limitMode && currentCpu > Settings.cpuMax) {
        break;
      }

    }

    const taskDropped = this.processQueue.length;

    this.clean();

    // Sanitaze

    statistics.total = Math.round((statistics.total + Number.EPSILON) * 100) / 100;
    const avg = Math.round(((statistics.total / Math.max(1, statistics.count)) + Number.EPSILON) * 100) / 100;
    const costByCreep = Math.round((statistics.total / Math.max(1, Object.keys(Game.creeps).length) + Number.EPSILON) * 100) / 100;

    log.info(`[${Game.time}] bucket: ${Game.cpu.bucket}, CPU used: ${statistics.total}, tasks: ${statistics.count}, avg: ${avg}, byCreeps: ${costByCreep}, taskDropped: ${taskDropped} `);
    
  }
  */

}