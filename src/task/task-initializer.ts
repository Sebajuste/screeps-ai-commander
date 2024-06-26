import { Task, TaskOptions, TaskTarget, isTaskTarget } from "task/Task";
import { HarvestTask, TASK_HARVEST_NAME } from "./tasks/HarvestTask";
import { log } from "utils/log";
import { isIdObject } from "./task-builder";
import { TASK_DROP_NAME, DropTask } from "./tasks/DropTask";
import { TASK_PICKUP_NAME, PickupTask } from "./tasks/PickupTask";
import { TRANSFER_TASK_NAME, TransferTask } from "./tasks/TransferTask";
import { TASK_WITHDRAW_NAME, WithdrawTask } from "./tasks/WithdrawTask";
import _, { Dictionary } from "lodash";
import { TASK_UPGRADE_NAME, UpgradeTask } from "./tasks/UpgradeTask";
import { TaskPipeline } from "./task-pipeline";
import { BuildTask, TASK_BUILD_NAME } from "./tasks/BuildTask";
import { TASK_WAIT_NAME, WaitTask } from "./tasks/WaitTask";
import { RepairTask, TASK_NAME_REPAIR } from "./tasks/RepairTask";
import { SignTask, TASK_SIGN_NAME } from "./tasks/SignTask";
import { AttackTask, TASK_ATTACK_NAME } from "./tasks/AttackTask";
import { ReserveTask, TASK_RESERVE_NAME } from "./tasks/ReserveTask";
import { DismantleTask, TASK_DISMANTLE_NAME } from "./tasks/DismantleTask";

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
  [TASK_ATTACK_NAME]: (target: any, options: TaskOptions) => new AttackTask(target),
  [TASK_BUILD_NAME]: (target: any, options: TaskOptions) => new BuildTask(target),
  [TASK_DISMANTLE_NAME]: (target: any, options: any) => new DismantleTask(target),
  [TASK_DROP_NAME]: (target: TaskTarget, options: TaskOptions) => new DropTask(target.pos, options.resourceType, options.amount),
  [TASK_HARVEST_NAME]: (target: any, options: TaskOptions) => new HarvestTask(target),
  [TASK_PICKUP_NAME]: (target: any, options: TaskOptions) => new PickupTask(target),
  [TASK_NAME_REPAIR]: (target: any, options: TaskOptions) => new RepairTask(target),
  [TASK_RESERVE_NAME]: (target: any, options: TaskOptions) => new ReserveTask(target),
  [TASK_SIGN_NAME]: (target: any, options: any) => new SignTask(target, options),
  [TRANSFER_TASK_NAME]: (target: any, options: TaskOptions) => new TransferTask(target, options.resourceType),
  [TASK_UPGRADE_NAME]: (target: any, options: TaskOptions) => new UpgradeTask(target),
  [TASK_WAIT_NAME]: (target: any, options: TaskOptions) => new WaitTask(target.pos, options.targetRange),
  [TASK_WITHDRAW_NAME]: (target: any, options: TaskOptions) => new WithdrawTask(target, options.resourceType)
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