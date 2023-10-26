import { Commander } from "Commander";
import { BuildDaemon } from "daemons";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";

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
    // throw new Error("Method not implemented.");
  }

  run(): void {
    // throw new Error("Method not implemented.");
  }

}