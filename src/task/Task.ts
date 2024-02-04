/**
 * https://docs.screeps.com/simultaneous-actions.html
 */
import { Exploration } from "Exploration";
import { Traveler } from "libs/traveler/traveler";
import _ from "lodash";
import { printCreep } from "utils/creep-utils";
import { log } from "utils/log";

export type TaskTarget = { id?: Id<_HasId>, pos: RoomPosition };

export interface TaskOptions {
  targetRange: number;
  oneShoot: boolean;
  [key: string]: any;
}

const DEFAULT_OPTIONS: TaskOptions = {
  targetRange: 1,
  oneShoot: false
};

export function isTaskTarget(obj: any): obj is TaskTarget {
  return (<TaskTarget>obj).pos != undefined;
}

export abstract class Task {

  name: string;
  target: TaskTarget;
  options: TaskOptions;

  reusePath?: number;

  constructor(name: string, target: TaskTarget, options: TaskOptions = DEFAULT_OPTIONS) {
    this.name = name;
    this.target = target;
    this.options = _.defaults(options, DEFAULT_OPTIONS);
  }

  eta(creep: Creep): number | undefined {
    if (creep) {
      const creepMemory: any = creep.memory;
      if (creepMemory._move && creepMemory._move.path) {
        return creepMemory._move.path.length;
      }
    }
  }

  isInRange(creep: Creep) {
    return creep.pos.inRangeTo(this.target, this.options.targetRange);
  }

  moveToTarget(creep: Creep): number {

    if (creep.fatigue > 0) {
      circle(creep.pos, "aqua", .3);
      return ERR_TIRED;
    }

    const r = creep.moveTo(this.target, {
      reusePath: this.reusePath != undefined ? this.reusePath : 5
    });
    // const r = creep.room.name == this.target.pos.roomName ? creep.moveTo(this.target) : Traveler.travelTo(creep, this.target);
    if (r != OK) {
      log.warning(`${printCreep(creep)} cannot move to ${this.target} ${JSON.stringify(this.target.pos)}, err : ${r}`);
      if (r == ERR_NO_PATH) {
        this.finish(creep);
      }
      /*
      else if (r == ERR_INVALID_ARGS) {
        Exploration.exploration().addInvalidRoom(this.target.pos.roomName);
        this.finish(creep);
        log.warning(`Error ERR_INVALID_ARGS for ${this.name}`);
      }
      */
    }

    return r;
  }

  finish(creep: Creep) {
    delete (creep.memory as any)['_move'];
  }

  abstract isFinished(creep: Creep): boolean;

  abstract action(creep: Creep): number;

  run(creep: Creep): boolean {

    if (this.isInRange(creep)) {
      // In range to run task

      const result = this.action(creep);

      if (result != OK) {
        log.debug(`${printCreep(creep)} run task [${this.name}] result : ${result}`);
      }

      if (this.options.oneShoot || result != OK || this.isFinished(creep)) {
        // This task is ended

        this.finish(creep);
        return true;
      }

    } else {
      // Move to task
      const result = this.moveToTarget(creep);
      if (result == ERR_INVALID_TARGET || result == ERR_NO_PATH) {
        // Cannot reach the target
        this.finish(creep)
        return true;
      }
      /*
      else if (this.isInRange(creep)) {
        // If we are now in range
        const result = this.action(creep);

        if (result != OK || this.isFinished(creep)) {
          // This task is ended
          this.finish(creep);
          return true;
        }
      }
      */
    }
    return false;
  }

}


function circle(pos: RoomPosition, color: any, opacity?: number) {
  new RoomVisual(pos.roomName).circle(pos, {
    radius: .45, fill: "transparent", stroke: color, strokeWidth: .15, opacity: opacity
  });
}