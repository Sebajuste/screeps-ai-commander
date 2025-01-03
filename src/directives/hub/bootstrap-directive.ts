import { PROCESS_PRIORITY_HIGHT } from "cpu/process";
import { BootstrapDaemon } from "daemons/civilian/bootstrap-daemon";
import { Directive } from "directives/Directive";

export class BootstrapDirective extends Directive {

  daemons: {
    bootstrap: BootstrapDaemon
  };

  spawnDaemons(): void {
    this.daemons.bootstrap = new BootstrapDaemon(this.hub, this, PROCESS_PRIORITY_HIGHT);
  }

  init(): void {

  }

  run(): void {

    /*
    if (this.hub.agents.length > 2) {
      this.hub.dispatcher.suspendDaemon(this.daemons.bootstrap, 100);
    }
    */

  }

}