import { Settings } from "settings";
import { Task, TaskTarget } from "task/Task";

export const TASK_ATTACK_CONTROLLER_NAME = 'attack_controller';

export class AttackControllerTask extends Task {

  constructor(target: TaskTarget) {
    super(TASK_ATTACK_CONTROLLER_NAME, target, { oneShoot: false, targetRange: 1 })
  }

  isFinished(creep: Creep): boolean {

    const room = Game.rooms[this.target.pos.roomName];

    if (!room) {
      return false;
    }

    if (!room?.controller) {
      return true;
    }

    return room.controller.reservation?.username == Settings.Username || room.controller.reservation?.ticksToEnd == 0;

  }

  action(creep: Creep): number {

    if (creep.pos.roomName != this.target.pos.roomName) {
      // Just move
      return OK;
    }

    if (!this.target.id && creep.pos.roomName == this.target.pos.roomName && creep.room.controller) {
      this.target = creep.room.controller;
    }

    return creep.attackController(this.target as StructureController);
  }

}