import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { AGENT_PRIORITIES } from "agent/agent-setup";
import { GuardRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";
import { createOutpostDirective } from "room/room-analyse";

export class GuardDaemon extends Daemon {


  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, `guard`, RunActivity.Outpost);
  }

  private spawnHandler(targetRoom: string) {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.guard,
      options: {
        memory: {
          targetRoom: targetRoom
        }
      }
    };

    const bodyParts = [MOVE, MOVE]

    const setup: AgentSetup = {
      role: 'guard',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  init(): void {


    this.hub.memory.outposts.forEach(targetRoom => {

      if (!Game.rooms[targetRoom]) {
        this.spawnHandler(targetRoom);
      } else {
        createOutpostDirective(this.hub, targetRoom);
      }

    });


  }

  run(): void {

    this.hub.memory.outposts.forEach(targetRoom => {

      if (Game.rooms[targetRoom]) {

        const agentAmount = _.filter(Game.creeps, creep => creep.pos.roomName == targetRoom).length;

        if (agentAmount > 1) {
          // Kill guard
          const guard = _.find(this.agents, agent => (<any>agent.creep.memory).targetRoom == targetRoom);
          if (guard) {
            guard.creep.suicide();
          }
        }

      }

    });

    this.autoRun(this.agents, agent => GuardRole.pipeline(agent, (agent.memory as any).targetRoom));

  }



}