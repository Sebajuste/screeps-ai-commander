import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { AGENT_PRIORITIES } from "agent/agent-setup";
import { ReserverRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";

export class ReserveDaemon extends Daemon {

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'reserve', RunActivity.Outpost);
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.reserver
    };

    const bodyParts = [CLAIM, CLAIM, MOVE, MOVE];

    const setup: AgentSetup = {
      role: 'reserver',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  init(): void {

    if (this.hub.storage && this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
      this.spawnHandler();
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => ReserverRole.pipeline(agent, this.pos.roomName));

  }

}