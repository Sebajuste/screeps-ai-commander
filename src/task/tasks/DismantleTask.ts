import { Task } from "task/Task";

export const TASK_DISMANTLE_NAME = 'dismantle';

export class DismantleTask extends Task {

  constructor(structure: Structure<StructureConstant>) {
    super(TASK_DISMANTLE_NAME, structure);
  }

  isFinished(creep: Creep): boolean {

    return this.target == undefined || creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0;

  }

  action(creep: Creep): number {
    return creep.dismantle(this.target as Structure<StructureConstant>);
  }

}