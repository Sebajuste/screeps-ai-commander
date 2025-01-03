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

  private _processStacks: ProcessStack[];

  private _processGroups: ProcessGroup[];

  private _stackIterator: number;

  static nextPID: number = 0;

  static currentId: number;

  empty() {
    // return this._processGroups.length = 0;
    return this._processStacks.length = 0;
  }

  init(processStacks: ProcessStack[]) {
    this._processStacks = processStacks;

    this._processGroups = _.map(processStacks, stack => ({stack: stack, count: stack.length, totalTime: 0}));

    // this._processGroups = _.map(processStacks, stack => ({ stack: stack.sort((p1, p2) => p1.priority - p2.priority), count: stack.length, totalTime: 0 } as ProcessGroup));
    Scheduler.currentId = 0;
    this._stackIterator = 0;
  }

  taskCount(): number {

    // return _.sum(_.map(this._processGroups, group => group.stack.length));
    return _.sum(_.map(this._processStacks, stack => stack.length));

  }

  private nextStack(): ProcessStack | null {

    const startIterator = this._stackIterator;

    let stack = [];

    do {
      stack = this._processStacks[this._stackIterator];
      this._stackIterator = (this._stackIterator + 1) % this._processStacks.length; // Go to next stack

      if( this._stackIterator == startIterator && stack.length == 0) {
        // All stacks was checked, and are empty
        return null;
      }

    } while(stack.length == 0);

    return stack;
  }


  nextProcess(): Process | null {

    Scheduler.currentId = 0;

    const stack = this.nextStack();

    if( !stack) {
      return null;
    }

    const process = stack.shift();

    if (!process) {
      return null;
    }

    Scheduler.currentId = process.pid;

    return process;

    /*
    const groupIndex = (this._iterator) % this._processStacks.length;
    const stack = this._processStacks[groupIndex];

    if (!group) {
      return null;
    }

    if (group.stack.length != group.count) {
      // If a process has had new process
      group.stack.sort((p1, p2) => p1.priority - p2.priority);
    }
    

    const process = group.stack.shift();

    group.count = group.stack.length; // Update process counter

    if (!process) {
      return null;
    }

    if (group.stack.length == 0) {
      // Current group is empty
      // this._processGroups.splice(groupIndex, 1); // Remove empty stack
    }

    this._iterator++; // Go to next group

    Scheduler.currentId = process.pid;

    return { process: process, group: group } as ExecutionProcess;
    */
  }

  private stopPreviousGroup(): number {
    const index = (this._stackIterator - 1) % this._processGroups.length;
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