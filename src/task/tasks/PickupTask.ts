import { Task } from "task/Task";

export const PICKUP_TASK_NAME = 'pickup';

export class PickupTask extends Task {

  constructor(resource: Resource<ResourceConstant>) {
    super(PICKUP_TASK_NAME, resource);
  }

  isFinished(creep: Creep): boolean {

    const targetIsEmpty = (this.target as Resource<ResourceConstant>).amount <= creep.store.getFreeCapacity((this.target as Resource<ResourceConstant>).resourceType);
    const creepIsFull = (this.target as Resource<ResourceConstant>).amount >= creep.store.getFreeCapacity((this.target as Resource<ResourceConstant>).resourceType);

    return targetIsEmpty || creepIsFull;
  }

  action(creep: Creep): number {
    return creep.pickup((this.target as Resource<ResourceConstant>));
  }

}