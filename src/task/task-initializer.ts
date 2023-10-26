import { Task, TaskOptions, TaskTarget, isTaskTarget } from "task/Task";
import { HarvestTask, HARVEST_TASK_NAME } from "./tasks/HarvestTask";
import { log } from "utils/log";
import { isIdObject } from "./task-builder";
import { DROP_TASK_NAME, DropTask } from "./tasks/DropTask";
import { PICKUP_TASK_NAME, PickupTask } from "./tasks/PickupTask";
import { TRANSFER_TASK_NAME, TransferTask } from "./tasks/TransferTask";
import { WITHDRAW_TASK_NAME, WithdrawTask } from "./tasks/WithdrawTask";
import _, { Dictionary } from "lodash";
import { UPGRADE_TASK_NAME, UpgradeTask } from "./tasks/UpgradeTask";
import { TaskPipeline } from "./task-pipeline";
import { BuildTask, TASK_BUILD_NAME } from "./tasks/BuildTask";
import { TASK_WAIT_NAME, WaitTask } from "./tasks/WaitTask";
import { RepairTask, TASK_NAME_REPAIR } from "./tasks/RepairTask";
import { SignTask, TASK_SIGN_NAME } from "./tasks/SignTask";

export function serializePos(pos: RoomPosition): string {
  return `${pos.x};${pos.y};${pos.roomName}`;
}

export function deserializePos(pos: string): RoomPosition {
  const split = pos.split(';');
  return new RoomPosition(parseInt(split[0]), parseInt(split[1]), split[2])
}

type SerializedTaskTarget = _HasId | { pos: string };

type TaskFactory = (target: TaskTarget, options: TaskOptions) => Task;

export const TASK_BUILDER: Dictionary<TaskFactory> = {
  [TASK_BUILD_NAME]: (target: any, options: TaskOptions) => new BuildTask(target),
  [DROP_TASK_NAME]: (target: TaskTarget, options: TaskOptions) => new DropTask(target.pos, options.resourceType, options.amount),
  [HARVEST_TASK_NAME]: (target: any, options: TaskOptions) => new HarvestTask(target),
  [PICKUP_TASK_NAME]: (target: any, options: TaskOptions) => new PickupTask(target),
  [TASK_NAME_REPAIR]: (target: any, options: TaskOptions) => new RepairTask(target),
  [TASK_SIGN_NAME]: (target: any, options: any) => new SignTask(target, options),
  [TRANSFER_TASK_NAME]: (target: any, options: TaskOptions) => new TransferTask(target, options.resourceType),
  [UPGRADE_TASK_NAME]: (target: any, options: TaskOptions) => new UpgradeTask(target),
  [TASK_WAIT_NAME]: (target: any, options: TaskOptions) => new WaitTask(target.pos, options.targetRange),
  [WITHDRAW_TASK_NAME]: (target: any, options: TaskOptions) => new WithdrawTask(target, options.resourceType)
};

export interface TaskInfo {
  name: string;
  target: SerializedTaskTarget;
  options: TaskOptions;
}

function serializeTask(task: Task): TaskInfo {

  return {
    name: task.name,
    target: task.target.id ? { id: task.target.id } : { pos: serializePos(task.target.pos) },
    options: task.options
  };

}

export function serializeTasks(pipeline: TaskPipeline): TaskInfo[] {

  if (pipeline.length == 0) {
    return [];
  }

  return _.map(pipeline, task => serializeTask(task));

}

export function deserializeTask(taskInfo: TaskInfo): Task | null {

  const target = isIdObject(taskInfo.target) ? (Game.getObjectById(taskInfo.target.id) as _HasId | null) : { pos: deserializePos(taskInfo.target.pos) } as _HasRoomPosition;

  if (target == null) {
    return null;
  }

  if (TASK_BUILDER.hasOwnProperty(taskInfo.name)) {
    if (isTaskTarget(target)) {
      return TASK_BUILDER[taskInfo.name](target, taskInfo.options);
    } else {
      log.error(`Invalid target ${target} with info : ${JSON.stringify(taskInfo)}`)
    }

  }
  log.error(`Cannot find ${taskInfo.name} into TASK_BUILDER, or invalid task info `, JSON.stringify(taskInfo));

  return null;
}

export function deserializeTasks(taskInfos: TaskInfo[]): TaskPipeline {

  return _.compact(_.map(taskInfos, info => deserializeTask(info))) as TaskPipeline;

}