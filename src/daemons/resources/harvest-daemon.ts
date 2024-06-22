import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, countValidBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HARVEST_BASIC_STRUCTURE_TEMPLATE, HARVEST_STRUCTURE_TEMPLATE } from "agent/agent-setup";
import { HarvestRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { EnergySourceDirective } from "directives/resources/energy-source-directive";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { log } from "utils/log";
import { findClosestByLimitedRange } from "utils/util-pos";
import { HaulerStat } from "../civilian/hauler-daemon";
import { Settings } from "settings";

export class HarvestDaemon extends Daemon {


  initializer: EnergySourceDirective;
  source: Source;

  ennemyDetected: boolean;

  memory: HaulerStat;

  _dropCache: MemCacheObject<Resource>;

  constructor(hub: Hub, initializer: EnergySourceDirective, source: Source, priority: number) {
    super(hub, initializer, 'harvest', initializer.pos.roomName == hub.pos.roomName ? RunActivity.LocalHarvest : RunActivity.Outpost, priority);
    this.initializer = initializer;
    this.source = source;
    this.ennemyDetected = false;


    this.memory = Mem.wrap(initializer.memory, 'haulerStat', { eta: 0, inputRate: 0 } as HaulerStat);
    this.memory.eta = (initializer.flag.memory as any).hubDistance;

    this._dropCache = new MemCacheObject<Resource>(initializer.memory, 'drop');
  }

  get inputRate(): number {
    return this.memory.inputRate ?? 1;
  }

  get eta(): number {
    return this.memory.eta ?? 1;
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.harvester
    };

    const isOutpostContainer = this.initializer.container && this.pos.roomName != this.hub.pos.roomName;
    const bodyParts = selectBodyParts(this.initializer.link || isOutpostContainer ? HARVEST_STRUCTURE_TEMPLATE : HARVEST_BASIC_STRUCTURE_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'energy_collector',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  private haveEnnemy() {

    if (!this.room) {
      // If harvest flag is in empty screeps room, the room is not available
      return false;
    }

    if (this.pos.roomName == 'sim') {
      this.ennemyDetected = findClosestByLimitedRange(this.pos, this.hub.hostilesCreepsByRooms[this.room.name], 5) != null;
    } else {
      this.ennemyDetected = (this.hub.hostilesCreepsByRooms[this.room.name] ?? []).length > 0;
    }
    return this.ennemyDetected;

  }

  get drop(): Resource | null {
    return this._dropCache.value;
  }

  refresh(): void {
    super.refresh();
    this._dropCache.refresh(this.initializer.memory);
  }

  init(): void {

    const roomReachable = Game.rooms[this.pos.roomName] != undefined;

    if (!roomReachable) {
      log.warning(`${this.print} Room unreachable`);
      this.memory.inputRate = 0;
      this.resourceFlowStats.pushInput(RESOURCE_ENERGY, 0);
      return;
    }

    const resourceInputRate = _.sum(this.agents.map(agent => countValidBodyPart(agent.creep, WORK))) * 2;
    this.memory.inputRate = resourceInputRate;

    const haveEnnemy = this.haveEnnemy();

    const containerFull = (this.initializer.container && this.initializer.container.store.getFreeCapacity(RESOURCE_ENERGY) == 0) ?? false;

    if (!haveEnnemy && (!containerFull || this.initializer.link)) {
      this.spawnHandler();
      this.resourceFlowStats.pushInput(RESOURCE_ENERGY, resourceInputRate);
    } else {
      this.memory.inputRate = 0;
    }

    if (this.initializer.container) {
      // Vacuum all resource container container
      for (const resource in this.initializer.container.store) {
        this.hub.logisticsNetwork.requestOutput(this.initializer.container, resource as ResourceConstant);

        if (this.hub.storage) {
          // Enable storage
          const maxStorageAmount = resource == RESOURCE_ENERGY ? Settings.hubStorageMaxEnergy : Settings.hubStorageMaxResource;
          if (this.hub.storage.store.getUsedCapacity(resource as ResourceConstant) < maxStorageAmount) {
            this.hub.logisticsNetwork.requestInput(this.hub.storage, resource as ResourceConstant);
          }
        }
      }
    }

    if (this.initializer.link && this.initializer.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Output the energy into Link
      this.hub.linkNetwork.requestOutput(this.initializer.link);
    }

    /*
    if (this.initializer.container) {
      if (this.initializer.container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        // Output the energy into container
        this.hub.logisticsNetwork.requestOutput(this.initializer.container, RESOURCE_ENERGY);
      }
      return;
    }
    */


    if (this.drop && (!this.initializer.container || this.drop.amount > this.initializer.container.store.getUsedCapacity(RESOURCE_ENERGY))) {
      // Output the energy droped
      console.log(`${this.print} request drop output`)
      this.hub.logisticsNetwork.requestOutput(this.drop, this.drop.resourceType);
    }

    if (this.agents.length > 0 && !this._dropCache.isValid()) {
      // NO cache update id no agent is present
      this._dropCache.value = findClosestByLimitedRange(this.pos, this.hub.dropsByRooms[this.room.name], 1);
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

    /*
    const container = this.initializer.container;
    if (container) {
      // Clear pipeline if harvester is not over container
      _.filter(this.agents, agent => !agent.pos.isEqualTo(container.pos)).forEach(agent => agent.taskPipelineHandler.clear());
    }
    */

    if (this.source.energy == 0) {
      // Sleep until energy respawn
      return;
    }

    this.autoRun(this.agents, agent => HarvestRole.pipeline(this.hub, agent, this.source, this.initializer.container, this.initializer.link));

  }

}
