import _ from "lodash";
import { log } from "utils/log";
import { Settings } from "settings";
import { Scheduler } from "./scheduler";

/**
 * Represents the Central Processing Unit (CPU) of the game environment.
 * This class manages and schedules processes to be executed based on their priority.
 */
export class CPU {

  static instance: CPU = new CPU();

  private _nextPid: number;

  private limitMode: boolean;

  private constructor() {
    this._nextPid = 0;
    this.limitMode = false;
  }

  private get nextPid() {
    return ++this._nextPid;
  }

  /**
   * Determines if the CPU bucket is above a certain threshold to allow tasks to run.
   * This function checks the current CPU bucket value against a predefined minimum limit.
   * If the bucket is lower than this limit, it logs a warning and returns false, indicating that tasks should not be run.
   * If the bucket is equal or above this limit, it returns true, allowing tasks to proceed.
   * @returns {boolean} A boolean value indicating whether tasks can be executed based on the current CPU bucket level.
   */
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

  /**
   * Runs processes in the scheduler based on their priority.
   *
   * This method sorts the process queue by priority, then iteratively executes each process' runnable function.
   * CPU usage and task count are tracked for statistical purposes. If the limit mode is enabled and the current CPU usage exceeds
   * a predefined maximum threshold, execution stops. The number of dropped tasks is calculated as the remaining tasks in the queue after execution.
   *
   * @param {Scheduler} scheduler - An instance of the Scheduler class containing processes to be executed.
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

    let process = scheduler.nextProcess();
    while (process != null) {
      let start = Game.cpu.getUsed();
      try {
        process.runnable();
      } catch (err: any) {
        log.fatal(err);
        log.fatal(err.stack);
      }
      const cpuUsed = Game.cpu.getUsed() - start;
      // exec.group.totalTime += cpuUsed;

      if( cpuUsed > 1) {
        log.warning(`Thread cpuUsed: ${cpuUsed}`, process.toString() );
      }

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

      /*
      if (exec.group.totalTime >= 25) {
        log.warning('Max CPU used for process group reached');
        taskDropped += scheduler.stopPreviousGroup();
      }
      */

      process = scheduler.nextProcess();
    }

    // Sanitaze

    statistics.total = Math.round((statistics.total + Number.EPSILON) * 100) / 100;
    const avg = Math.round(((statistics.total / Math.max(1, statistics.count)) + Number.EPSILON) * 100) / 100;
    const costByCreep = Math.round((statistics.total / Math.max(1, Object.keys(Game.creeps).length) + Number.EPSILON) * 100) / 100;

    log.info(`[${Game.time}] bucket: ${Game.cpu.bucket}, CPU used: ${statistics.total}, tasks: ${statistics.count}, remain: ${scheduler.taskCount()}, avg: ${avg}, byCreeps: ${costByCreep}, taskDropped: ${taskDropped} `);

  }

}