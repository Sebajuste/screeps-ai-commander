import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { AGENT_PRIORITIES } from "agent/agent-setup";
import { BootstrapRole } from "agent/roles";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";

export class BootstrapDaemon extends Daemon {

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'boostrap', RunActivity.Always);
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.bootstrap
    };

    const bodyParts = [WORK, CARRY, MOVE];

    const setup: AgentSetup = {
      role: 'bootstrap',
      bodyParts: bodyParts
    };

    const quantity = 2;

    this.wishList(quantity, setup, options);

  }

  init(): void {

    if (this.hub.agents.length <= 1) {
      this.spawnHandler();
    }

  }

  run(): void {
    this.autoRun(this.agents, agent => BootstrapRole.pipeline(this.hub, agent));
  }

}