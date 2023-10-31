import _ from "lodash";
import { Process, ProcessStack } from "./process";
import { log } from "utils/log";

interface ProcessGroup {
  stack: ProcessStack;
  count: number;
  totalTime: number;
}

export interface ExecutionProcess {

  process: Process;
  group: ProcessGroup;

}


export class Scheduler {

  private _processGroups: ProcessGroup[];

  private _iterator: number;

  static nextPID: number = 0;

  static currentId: number;

  empty() {
    return this._processGroups.length = 0;
  }

  init(processStacks: ProcessStack[]) {
    this._processGroups = _.map(processStacks, stack => ({ stack: stack.sort((p1, p2) => p1.priority - p2.priority), count: stack.length, totalTime: 0 } as ProcessGroup));
    Scheduler.currentId = 0;
    this._iterator = 0;
  }

  taskCount(): number {

    return _.sum(_.map(this._processGroups, group => group.stack.length));

  }

  nextProcess(): ExecutionProcess | null {

    const index = (this._iterator) % this._processGroups.length;
    const group = this._processGroups[index];

    if (!group) {
      Scheduler.currentId = 0;
      return null;
    }

    if (group.stack.length != group.count) {
      // If a process has had new process
      group.stack.sort((p1, p2) => p1.priority - p2.priority);
    }

    const process = group.stack.shift();

    group.count = group.stack.length; // Update process counter

    if (!process) {
      Scheduler.currentId = 0;
      return null;
    }

    if (group.stack.length == 0) {
      // Remove empty stack
      this._processGroups.splice(index, 1);
    }

    this._iterator++;

    Scheduler.currentId = process.pid;

    return { process: process, group: group } as ExecutionProcess;

  }

  stopPreviousGroup(): number {
    const index = (this._iterator - 1) % this._processGroups.length;
    if (!this._processGroups[index]) {
      return 0;
    }
    const count = this._processGroups[index].stack.length;
    log.debug(`this._processGroups index: ${index}, length: `, this._processGroups.length);
    this._processGroups.splice(index, 1);
    log.debug('> this._processGroups length', this._processGroups.length);
    return count;
  }


}