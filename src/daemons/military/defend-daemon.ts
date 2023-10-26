import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, COMMANDO_TEMPLATE } from "agent/agent-setup";
import { CommandoRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import { Hub } from "hub/Hub";

export class DefendDaemon extends Daemon {

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'defend');
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.commando
    };

    const bodyParts = selectBodyParts(COMMANDO_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'commando',
      bodyParts: bodyParts
    };

    this.wishList(2, setup, options);

  }

  init(): void {

    if ((this.hub.hostilesCreepsByRooms[this.pos.roomName] ?? []).length > 0) {
      // Ennemy detected
      this.spawnHandler();
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => CommandoRole.pipeline(agent, this.pos.roomName, this.hub.hostilesCreepsByRooms[this.pos.roomName] ?? [], []));

  }

}