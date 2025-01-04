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


/**
 * The Scheduler class manages the execution of processes in a series of stacks.
 * It keeps track of the current process and its group, as well as the total number of tasks and time taken by each process group.
 * The nextProcess method is used to retrieve the next process to be executed from the stack.
 */
export class Scheduler {

  private _processStacks: ProcessStack[];

  private _processGroups: ProcessGroup[];

  private _stackIterator: number;

  static nextPID: number = 0;

  static currentId: number;

  empty() {
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


/**
 * Retrieves the next process to be executed from the stack.
 * This method advances the iterator to the next stack and returns the first process in that stack.
 * If there are no more processes left in any stack, it resets the iterator and returns null.
 * The method also updates the current ID of the Scheduler class with the PID of the returned process.
 * @returns {Process | null} - The next process to be executed or null if there are no more processes left in any stack.
 */
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