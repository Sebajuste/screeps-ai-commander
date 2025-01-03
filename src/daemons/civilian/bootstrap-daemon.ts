import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { AGENT_PRIORITIES } from "agent/agent-setup";
import { BootstrapRole } from "agent/roles";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { log } from "utils/log";

export class BootstrapDaemon extends Daemon {

  constructor(hub: Hub, initializer: Actor, priority?: number) {
    super(hub, initializer, 'boostrap', RunActivity.Always, priority);
  }

  private spawnHandler() {

    log.debug('BootstrapDaemon::spawnHandler')

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

    if (this.hub.agents.length < 2) {
      this.spawnHandler();
    }

  }

  run(): void {
    this.autoRun(this.agents, agent => BootstrapRole.pipeline(this.hub, agent));
  }

}