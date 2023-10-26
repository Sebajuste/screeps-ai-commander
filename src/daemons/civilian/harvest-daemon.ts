import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HARVEST_BASIC_STRUCTURE_TEMPLATE, HARVEST_STRUCTURE_TEMPLATE } from "agent/agent-setup";
import { HarvestRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { EnergySourceDirective } from "directives/resources/energy-source-directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { log } from "utils/log";
import { findClosestByLimitedRange } from "utils/util-pos";
import { HaulerStat } from "./hauler-daemon";

export class HarvestDaemon extends Daemon {


  initializer: EnergySourceDirective;
  source: Source;

  containerFull: boolean;

  memory: HaulerStat;

  constructor(hub: Hub, initializer: EnergySourceDirective, source: Source, priority: number) {
    super(hub, initializer, 'harvest', priority);
    this.initializer = initializer;
    this.source = source;
    this.containerFull = false;
    this.memory = Mem.wrap(initializer.memory, 'haulerStat', { eta: 0 });

    this.memory.eta = (initializer.flag.memory as any).hubDistance / 2;
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.harvester
    };

    const bodyParts = selectBodyParts(HARVEST_BASIC_STRUCTURE_TEMPLATE, this.hub.room.energyAvailable);

    const workPerHarvester = countBodyPart(bodyParts, WORK);
    this.memory.inputRate = workPerHarvester * 2;

    const setup: AgentSetup = {
      role: 'energy_collector',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  init(): void {

    const roomReachable = Game.rooms[this.pos.roomName] != undefined;

    if (!roomReachable) {
      log.warning(`${this.print} Room unreachable`);
      return;
    }

    const haveEnnemy = roomReachable && findClosestByLimitedRange(this.pos, this.hub.hostilesCreepsByRooms[this.room.name] ?? [], 5) != null;
    this.containerFull = (this.initializer.container && this.initializer.container.store.getFreeCapacity(RESOURCE_ENERGY) == 0) ?? false;

    if (!haveEnnemy && !this.containerFull) {
      this.spawnHandler();
    } else {
      this.memory.inputRate = 0;
    }

    const drop = findClosestByLimitedRange(this.pos, this.hub.dropsByRooms[this.room.name], 1);
    if (drop) {
      this.hub.logisticsNetwork.requestOutput(drop, drop.resourceType);
    }

    if (this.initializer.container && this.initializer.container.store.getUsedCapacity(RESOURCE_ENERGY)) {
      this.hub.logisticsNetwork.requestOutput(this.initializer.container, RESOURCE_ENERGY);
    }

  }

  run(): void {

    const container = this.initializer.container;
    if (container) {
      // Clear pipeline if harvester is not over container
      _.filter(this.agents, agent => !agent.pos.isEqualTo(container.pos)).forEach(agent => agent.taskPipelineHandler.clear());
    }

    this.autoRun(this.agents, agent => HarvestRole.pipeline(this.hub, agent, this.source, container));

  }

}
