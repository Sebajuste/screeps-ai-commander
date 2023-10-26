import { Task } from "task/Task";
import { printCreep } from "utils/creep-utils";
import { log } from "utils/log";

export const UPGRADE_TASK_NAME = 'upgrade';

export class UpgradeTask extends Task {

  constructor(controller: StructureController) {
    super(UPGRADE_TASK_NAME, controller, { oneShoot: false, targetRange: 3 });
  }

  isFinished(creep: Creep): boolean {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) <= countBodyPart(creep.body, WORK);
  }

  action(creep: Creep): number {

    return creep.upgradeController(this.target as StructureController);

  }

}

function countBodyPart(bodyParts: BodyPartDefinition[], bodyPart: BodyPartConstant): number {
  return bodyParts.filter(it => it.type == bodyPart).length;
}