import { Task } from "task/Task";
import { StoreStructure } from "task/task-builder";

export const TASK_WITHDRAW_NAME = 'withdraw';

export class WithdrawTask extends Task {

  constructor(target: StoreStructure | Tombstone, resourceType: ResourceConstant, amount?: number) {
    super(TASK_WITHDRAW_NAME, target, { targetRange: 1, oneShoot: true, resourceType: resourceType, amount: amount })
  }

  isFinished(creep: Creep): boolean {
    return creep.store.getFreeCapacity(this.options.resourceType) == 0 || (this.target as StoreStructure).store.getUsedCapacity(this.options.resourceType) == 0;
  }

  action(creep: Creep): number {
    return creep.withdraw(this.target as StoreStructure | Tombstone, this.options.resourceType, this.options.amount);
  }

}