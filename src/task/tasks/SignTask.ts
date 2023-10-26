import { Task } from "task/Task";
import { log } from "utils/log";

export const TASK_SIGN_NAME = "sign";



export class SignTask extends Task {

  constructor(controller: StructureController, text: string) {
    super(TASK_SIGN_NAME, controller, { targetRange: 1, oneShoot: true, text: text })
  }

  isFinished(creep: Creep): boolean {
    return (this.target as StructureController).sign?.text === this.options.text;
  }


  action(creep: Creep): number {

    return creep.signController(this.target as StructureController, this.options.text);

  }

}