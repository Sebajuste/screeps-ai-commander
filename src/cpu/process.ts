import { log } from "utils/log";
import { Scheduler } from "./scheduler";

export const PROCESS_PRIORITY_HIGHT = 10;
export const PROCESS_PRIORITY_NORMAL = 100;
export const PROCESS_PRIORITY_LOW = 1000;

let nextPID = 0;

export interface Process {
  pid: number;
  parent?: number
  createdAt: number;
  priority: number;
  runnable: () => void;
}

export type ProcessStack = Process[];

export function pushProcess(stack: ProcessStack, runnable: () => void, priority: number = PROCESS_PRIORITY_NORMAL) {
  stack.push({
    pid: ++nextPID,
    parent: Scheduler.currentId,
    createdAt: Game.time,
    priority: priority,
    runnable: runnable
  } as Process);
}
