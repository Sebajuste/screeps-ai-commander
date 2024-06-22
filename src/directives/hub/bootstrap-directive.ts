import { BootstrapDaemon } from "daemons/civilian/bootstrap-daemon";
import { Directive } from "directives/Directive";

export class BootstrapDirective extends Directive {

  daemons: {
    bootstrap: BootstrapDaemon
  };

  spawnDaemons(): void {
    this.daemons.bootstrap = new BootstrapDaemon(this.hub, this);
  }

  init(): void {

  }

  run(): void {

    if (this.hub.agents.length > 1) {
      this.hub.dispatcher.suspendDaemon(this.daemons.bootstrap, 100);
    }

  }

}