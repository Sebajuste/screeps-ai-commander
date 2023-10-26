import { Task } from "task/Task";
import { log } from "utils/log";

export const TASK_WAIT_NAME = 'wait';

export class WaitTask extends Task {

  constructor(pos: RoomPosition, targetRange: number = 1) {
    super(TASK_WAIT_NAME, { pos: pos }, { oneShoot: true, targetRange: targetRange })
  }

  isFinished(creep: Creep): boolean {
    return creep.pos.inRangeTo(this.target.pos, this.options.targetRange);
  }

  action(creep: Creep): number {
    return OK;
  }

}