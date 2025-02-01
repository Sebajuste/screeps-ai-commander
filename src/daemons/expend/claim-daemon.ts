import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, CLAIMER_TEMPLATE } from "agent/agent-setup";
import { ClaimerRole } from "agent/roles/claimer";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { log } from "utils/log";

export class ClaimDaemon extends Daemon {


  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'claim', RunActivity.Always);
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.claimer
    };

    const bodyParts = selectBodyParts(CLAIMER_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'claimer',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  init(): void {

    if (this.room && !this.room.controller?.my) {
      // Avoid spawn if room is not controlled
      this.spawnHandler();
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => ClaimerRole.pipeline(this.pos.roomName));

  }

  visuals(): void {

    Game.map.visual.line(
      this.hub.pos,
      this.pos,
      { color: '#781a4e', opacity: 0.8, width: 1.0, lineStyle: 'dashed' }
    );

    Game.map.visual.circle(
      this.pos,
      { fill: '#1a3d78', opacity: 0.5, radius: 50, stroke: '#808080' }
    );

  }

}