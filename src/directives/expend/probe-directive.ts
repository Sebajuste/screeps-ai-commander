import { Commander } from "Commander";
import { ProbeDaemon } from "daemons";
import { GuardDaemon } from "daemons/expend/guard-daemon";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";

export class ProbeDirective extends Directive {

  daemons: {
    probe: ProbeDaemon
    guard: GuardDaemon
  };

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub);
  }

  spawnDaemons(): void {
    if (this.room.name != 'sim') {
      // No multi room for Simulation
      this.daemons.probe = new ProbeDaemon(this.hub, this);
      this.daemons.guard = new GuardDaemon(this.hub, this);
    }
  }

  init(): void {

  }

  run(): void {

  }

}