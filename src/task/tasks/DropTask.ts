import { Task } from "task/Task";
import { printCreep } from "utils/creep-utils";
import { log } from "utils/log";

export const TASK_DROP_NAME = 'drop';

export class DropTask extends Task {

  constructor(pos: RoomPosition, resourceType: ResourceConstant, amount?: number) {
    super(TASK_DROP_NAME, { pos: pos }, { targetRange: 1, oneShoot: true, resourceType: resourceType, amount: amount })
  }

  isFinished(creep: Creep): boolean {
    // return creep.store.getUsedCapacity(this.options.resourceType) > 0;
    return true;
  }


  action(creep: Creep): number {
    log.debug(`${printCreep(creep)} DROP ${this.options.resourceType} [${this.options.amount}]`)
    return creep.drop(this.options.resourceType, this.options.amount);
  }

}