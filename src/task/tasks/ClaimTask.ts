import { Task, TaskTarget } from "task/Task";

export const TASK_CLAIM_NAME = 'claim';

export class ClaimTask extends Task {

  constructor(target: TaskTarget) {
    super(TASK_CLAIM_NAME, target, { oneShoot: false, targetRange: 3 })
  }

  isFinished(creep: Creep): boolean {

    const room = Game.rooms[this.target.pos.roomName];

    if (!room) {
      return false;
    }

    return room.controller?.my ?? false;

  }

  action(creep: Creep): number {

    if (creep.pos.roomName != this.target.pos.roomName) {
      // Just move
      return OK;
    }

    if (!this.target.id && creep.pos.roomName == this.target.pos.roomName && creep.room.controller) {
      this.target = creep.room.controller;
    }

    return creep.claimController(this.target as StructureController);
  }

}