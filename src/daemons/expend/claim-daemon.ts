import { Actor } from "Actor";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";

export class ClaimDaemon extends Daemon {


  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'claim', RunActivity.Always);
  }

  init(): void {
    throw new Error("Method not implemented.");
  }

  run(): void {
    throw new Error("Method not implemented.");
  }

}