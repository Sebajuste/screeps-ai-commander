import { Task } from "task/Task";
import { countBodyPart, countValidBodyPart, haveBodyPart } from "agent/agent-builder";
import { log } from "utils/log";
import { StoreStructure } from "task/task-builder";

export const HARVEST_TASK_NAME = 'harvest';

export class HarvestTask extends Task {

  _container?: StoreStructure | null;

  constructor(target: Source | Mineral<MineralConstant> | Deposit, container?: StoreStructure | null) {
    super(HARVEST_TASK_NAME, target, { oneShoot: false, targetRange: 1, containerID: container?.id });
    this._container = container;
  }

  get container(): StoreStructure | null | undefined {
    if (!this._container && this.options.containerID) {
      this._container = Game.getObjectById(this.options.containerID) as StoreStructure | null;
    }
    return this._container;
  }

  isFinished(creep: Creep): boolean {

    if (this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
      // Finish if container is full
      return true;
    }

    if (haveBodyPart(creep, CARRY) && creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
      // Finish if creep is full
      return true;
    }

    // Source is empty
    return (this.target as Source).energy <= countValidBodyPart(creep, CARRY) * 10 || (this.target as Source).energy <= countValidBodyPart(creep, WORK) * 1.5;

  }

  action(creep: Creep): number {
    return creep.harvest(this.target as Source | Mineral<MineralConstant> | Deposit)
  }

}