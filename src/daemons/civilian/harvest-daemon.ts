import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HARVEST_BASIC_STRUCTURE_TEMPLATE, HARVEST_STRUCTURE_TEMPLATE } from "agent/agent-setup";
import { HarvestRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { EnergySourceDirective } from "directives/resources/energy-source-directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { log } from "utils/log";
import { findClosestByLimitedRange } from "utils/util-pos";
import { HaulerStat } from "./hauler-daemon";

export class HarvestDaemon extends Daemon {


  initializer: EnergySourceDirective;
  source: Source;

  containerFull: boolean;

  ennemyDetected: boolean;

  memory: HaulerStat;

  _dropCache: MemCacheObject<Resource>;

  constructor(hub: Hub, initializer: EnergySourceDirective, source: Source, priority: number) {
    super(hub, initializer, 'harvest', priority);
    this.initializer = initializer;
    this.source = source;
    this.containerFull = false;
    this.ennemyDetected = false;


    this.memory = Mem.wrap(initializer.memory, 'haulerStat', { eta: 0 });
    this.memory.eta = (initializer.flag.memory as any).hubDistance / 2;

    this._dropCache = new MemCacheObject<Resource>(this.memory, 'drop');
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.harvester
    };

    const bodyParts = selectBodyParts(this.initializer.link ? HARVEST_STRUCTURE_TEMPLATE : HARVEST_BASIC_STRUCTURE_TEMPLATE, this.hub.room.energyAvailable);

    const workPerHarvester = countBodyPart(bodyParts, WORK);
    this.memory.inputRate = workPerHarvester * 2;

    const setup: AgentSetup = {
      role: 'energy_collector',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  private haveEnnemy() {

    if (Game.time % 10 == 0) {
      this.ennemyDetected = findClosestByLimitedRange(this.pos, this.hub.hostilesCreepsByRooms[this.room.name] ?? [], 5) != null;
    }
    return this.ennemyDetected;

  }

  get drop(): Resource | null {
    return this._dropCache.value;
  }

  refresh(): void {
    super.refresh();
    this._dropCache.refresh(this.memory);
  }

  init(): void {

    const roomReachable = Game.rooms[this.pos.roomName] != undefined;

    if (!roomReachable) {
      log.warning(`${this.print} Room unreachable`);
      return;
    }

    const haveEnnemy = this.haveEnnemy();

    this.containerFull = (this.initializer.container && this.initializer.container.store.getFreeCapacity(RESOURCE_ENERGY) == 0) ?? false;

    if (!haveEnnemy && !this.containerFull) {
      this.spawnHandler();
    } else {
      this.memory.inputRate = 0;
    }

    if (this.initializer.link) {
      if (this.initializer.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        // Output the energy into Link
        this.hub.linkNetwork.requestOutput(this.initializer.link);
      }
      return;
    }

    if (this.initializer.container) {
      if (this.initializer.container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        // Output the energy into container
        this.hub.logisticsNetwork.requestOutput(this.initializer.container, RESOURCE_ENERGY);
      }
      return;
    }

    if (!this._dropCache.isValid()) {
      this._dropCache.value = findClosestByLimitedRange(this.pos, this.hub.dropsByRooms[this.room.name], 1);
    }

    // Output the energy droped
    if (this.drop) {
      this.hub.logisticsNetwork.requestOutput(this.drop, this.drop.resourceType);
    }


    /*
    const haveStoreStructure = this.initializer.container || this.initializer.link;

    if (this.initializer.container && this.initializer.container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Output the energy into container
      this.hub.logisticsNetwork.requestOutput(this.initializer.container, RESOURCE_ENERGY);
    }

    if (this.initializer.link && this.initializer.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Output the energy into Link
      this.hub.linkNetwork.requestOutput(this.initializer.link);
    }

    if (!haveStoreStructure && this.drop) {

      if (!this._dropCache.isValid()) {
        this._dropCache.value = findClosestByLimitedRange(this.pos, this.hub.dropsByRooms[this.room.name], 1);
      }

      // Output the energy droped
      this.hub.logisticsNetwork.requestOutput(this.drop, this.drop.resourceType);
    }
    */


  }

  run(): void {

    const container = this.initializer.container;
    if (container) {
      // Clear pipeline if harvester is not over container
      _.filter(this.agents, agent => !agent.pos.isEqualTo(container.pos)).forEach(agent => agent.taskPipelineHandler.clear());
    }

    this.autoRun(this.agents, agent => HarvestRole.pipeline(this.hub, agent, this.source, container, this.initializer.link));

  }

}
