import { Commander } from "Commander";
import { BuildDaemon } from "daemons";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import { log } from "utils/log";

export class BuildDirective extends Directive {

  daemons: {
    build: BuildDaemon
  };

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub)
  }

  spawnDaemons(): void {

    this.daemons.build = new BuildDaemon(this.hub, this);

  }

  init(): void {

    log.debug(`${this.print} - build isDaemonSuspended ${this.hub.dispatcher.isDaemonSuspended(this.daemons.build)}`);

  }

  run(): void {

  }

}