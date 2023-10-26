import { Task } from "task/Task";

export const TASK_NAME_REPAIR = 'repair';

export class RepairTask extends Task {

  constructor(structure: Structure) {
    super(TASK_NAME_REPAIR, structure);
  }

  isFinished(creep: Creep): boolean {
    const structure = this.target as Structure;
    return structure.hits == structure.hitsMax || creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0;
  }

  action(creep: Creep): number {

    return creep.repair(this.target as Structure);

  }

}