import { countValidBodyPart } from "agent/agent-builder";
import { Task } from "task/Task";

export const TASK_BUILD_NAME = 'build';

export class BuildTask extends Task {

  constructor(target: ConstructionSite) {
    super(TASK_BUILD_NAME, target, { oneShoot: false, targetRange: 3 })
  }

  isFinished(creep: Creep): boolean {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) <= countValidBodyPart(creep, WORK) * 5;
  }

  action(creep: Creep): number {
    return creep.build(this.target as ConstructionSite);
  }

}