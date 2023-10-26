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