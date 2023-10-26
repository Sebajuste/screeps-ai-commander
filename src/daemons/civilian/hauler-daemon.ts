import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HAULER_TEMPLATE } from "agent/agent-setup";
import { HaulerRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { Hub } from "hub/Hub";
import { Mem } from "memory/Memory";
import { log } from "utils/log";
import { MathRange } from "utils/math";


export interface HaulerStat {
  inputRate: number;
  eta: number;
}

export class HaulerDaemon extends Daemon {

  initializer: Actor;

  maxQuantity?: number;
  memory: HaulerStat;

  constructor(hub: Hub, initializer: Actor, priority?: number, maxQuantity?: number) {
    super(hub, initializer, 'hauler', priority);
    this.initializer = initializer;
    this.maxQuantity = maxQuantity;
    this.memory = Mem.wrap(initializer.memory, 'haulerStat', { eta: 0, inputRate: 0 });
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.hauler
    };

    const bodyParts = selectBodyParts(HAULER_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'hauler',
      bodyParts: bodyParts
    };

    const haulerEta = this.memory.eta * this.memory.inputRate * 2;
    const carryPerAgent = countBodyPart(bodyParts, CARRY);

    const haulerQuantity = MathRange(1, this.maxQuantity ?? 1, haulerEta / carryPerAgent);

    this.wishList(1, setup, options);

  }

  refresh(): void {
    this.memory = Mem.wrap(this.initializer.memory, 'haulerStat', {});
  }

  init(): void {
    if (!this.reachable) {
      log.warning(`${this.print} room not reachable`)
    }

    this.spawnHandler();
  }

  run(): void {

    this.autoRun(this.agents, agent => HaulerRole.newTasks(this.hub, agent, this.hub.logisticsNetwork.getLogisticsRequest(agent)));

  }

}
