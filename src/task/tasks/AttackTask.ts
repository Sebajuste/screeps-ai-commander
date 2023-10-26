import { countValidBodyPart } from "agent/agent-builder";
import { Task } from "task/Task";

export const TASK_ATTACK_NAME = 'attack';

export class AttackTask extends Task {

  constructor(target: AnyCreep | Structure<StructureConstant>) {
    super(TASK_ATTACK_NAME, target);
  }

  isFinished(creep: Creep): boolean {

    return !this.target || countValidBodyPart(creep, ATTACK) == 0;

  }

  action(creep: Creep): number {
    return creep.attack(this.target as AnyCreep | Structure<StructureConstant>);
  }

}