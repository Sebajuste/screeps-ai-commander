import { Commander } from "Commander";
import { ClaimDaemon } from "daemons/expend/claim-daemon";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";

export class ClaimDirective extends Directive {

  daemons: {
    claim: ClaimDaemon
  };

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub);
  }

  spawnDaemons(): void {

    this.daemons.claim = new ClaimDaemon(this.hub, this);

  }

  init(): void {
  }

  run(): void {
  }

}