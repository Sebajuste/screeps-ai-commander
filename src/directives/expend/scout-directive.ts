import { Commander } from "Commander";
import { ScoutDaemon } from "daemons";
import { GuardDaemon } from "daemons/expend/guard-daemon";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import { log } from "utils/log";

export class ScoutDirective extends Directive {

  daemons: {
    scout: ScoutDaemon
    guard: GuardDaemon
  };

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub)
  }

  spawnDaemons(): void {
    if (this.room.name != 'sim') {
      // No multi room for Simulation
      this.daemons.scout = new ScoutDaemon(this.hub, this);
      this.daemons.guard = new GuardDaemon(this.hub, this);
    }
  }

  init(): void {

  }

  run(): void {

  }

}