import _ from "lodash";
import { ProcessStack } from "./process";

export class Scheduler {


  run(processStacks: ProcessStack[]): void {


    let canContinue = true;

    while (canContinue) {
      _.remove(processStacks, stack => stack.empty || stack.totalTime >= 15);
      _.forEach(processStacks, stack => stack.runNextProcess());
    }


  }

}