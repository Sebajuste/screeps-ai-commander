import { Task } from "task/Task";
import { countBodyPart, countValidBodyPart, haveBodyPart } from "agent/agent-builder";
import { log } from "utils/log";
import { StoreStructure } from "task/task-builder";

export const TASK_HARVEST_NAME = 'harvest';

export class HarvestTask extends Task {

  _container?: StoreStructure | null;

  constructor(target: Source | Mineral<MineralConstant> | Deposit, container?: StoreStructure | null, oneShoot?: boolean) {
    super(TASK_HARVEST_NAME, target, { oneShoot: oneShoot != undefined ? oneShoot : false, targetRange: 1, containerID: container?.id });
    this._container = container;
  }

  get container(): StoreStructure | null | undefined {
    if (!this._container && this.options.containerID) {
      this._container = Game.getObjectById(this.options.containerID) as StoreStructure | null;
    }
    return this._container;
  }

  isFinished(creep: Creep): boolean {

    const carry = countValidBodyPart(creep, CARRY);

    /*
    if (carry) {

      if (this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY) <= 50) {
        // Finish if container will be full
        return true;
      }

      const harvestByTick = countValidBodyPart(creep, WORK) * 2;

      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= harvestByTick) {
        // Finish if creep will be full
        return true;
      }

      if ((this.target as Source).energy <= harvestByTick) {
        // Source will be empty
        return true;
      }

    } else {
*/
    if (this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
      // Finish if container is full
      return true;
    }

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
      // Finish if creep is full
      return true;
    }

    if ((this.target as Source).energy == 0) {
      // Source is empty
      return true;
    }

    //}

    return false;

    /*
    if (this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY) <= (haveCarry ? 50 : 0)) {
      // Finish if container is full
      return true;
    }

    if (haveCarry && creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 50) {
      // Finish if creep is full
      return true;
    }
    

    // Source is empty
    return (this.target as Source).energy <= countValidBodyPart(creep, CARRY) * 10 || (this.target as Source).energy <= countValidBodyPart(creep, WORK) * 1.5;
    */

  }

  action(creep: Creep): number {
    return creep.harvest(this.target as Source | Mineral<MineralConstant> | Deposit)
  }

}