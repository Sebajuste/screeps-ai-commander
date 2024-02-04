import { Task } from "task/Task";
import { isSamePos } from "utils/util-pos";

export const TASK_WAIT_NAME = 'wait';

export class WaitTask extends Task {

  constructor(pos: RoomPosition, targetRange: number = 1, sleepTick: number = Game.time) {
    super(TASK_WAIT_NAME, { pos: pos }, { oneShoot: true, targetRange, sleepTick });
    this.reusePath = 50;
  }

  isFinished(creep: Creep): boolean {
    if (this.options.sleepTick > Game.time) {
      return false;
    }
    if (this.options.targetRange === 0) {
      return creep.pos.roomName != this.target.pos.roomName || creep.pos.x != this.target.pos.x || creep.pos.y == this.target.pos.y;
    }
    return creep.pos.inRangeTo(this.target.pos, this.options.targetRange);
  }

  action(creep: Creep): number {
    return OK;
  }

}