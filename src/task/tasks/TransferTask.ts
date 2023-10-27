import { Task } from "task/Task";
import { StoreStructure } from "task/task-builder";

export const TRANSFER_TASK_NAME = 'transfer';

export class TransferTask extends Task {

  constructor(target: StoreStructure, resourceType: ResourceConstant) {
    super(TRANSFER_TASK_NAME, target, { targetRange: 1, oneShoot: true, resourceType: resourceType })
  }

  isFinished(creep: Creep): boolean {

    /*
    const creepAmount = creep.store.getUsedCapacity(this.options.resourceType) ?? 0;
    const storeAmount = (this.target as StoreStructure).store.getFreeCapacity(this.options.resourceType) ?? 0;
    return creepAmount == 0 || storeAmount <= creepAmount;
    */
    return true;

  }
  action(creep: Creep): number {
    return creep.transfer((this.target as StoreStructure), this.options.resourceType);
  }

}