import { Task } from "task/Task";

export const TASK_RESERVE_NAME = 'reserve';

export class ReserveTask extends Task {

  constructor(controller: StructureController) {
    super(TASK_RESERVE_NAME, controller)
  }

  isFinished(creep: Creep): boolean {

    return false;

  }

  action(creep: Creep): number {
    return creep.reserveController(this.target as StructureController);
  }

}