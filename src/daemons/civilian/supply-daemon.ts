import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, SUPPLY_TEMPLATE } from "agent/agent-setup";
import { SupplierRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import { RunActivity } from "hub/Hub";
import _ from "lodash";
import { Settings } from "settings";
import { StoreStructure, Tasks } from "task/task-builder";
import { log } from "utils/log";

export class SupplyDaemon extends Daemon {


  sources?: StoreStructure[];

  destinations?: StoreStructure[];

  constructor(initializer: Actor) {
    super(initializer.hub, initializer, 'supply', RunActivity.Always);
  }

  private spawnSuppliers() {

    if (this.hub.extentions.length == 0) {
      // No necessity of supplier
      return;
    }

    const bodyParts = selectBodyParts(SUPPLY_TEMPLATE, this.hub.room.energyAvailable);

    const options = {
      priority: AGENT_PRIORITIES.supplier
    } as AgentRequestOptions;

    const setup: AgentSetup = {
      role: 'supplier',
      bodyParts: bodyParts
    };

    const count = this.hub.extentions.length > 20 && (this.hub.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0 > 5000) ? 2 : 1;

    this.wishList(count, setup, options);

  }

  private populateStructure() {

    if (!this.sources) {
      //const containers = _.filter(this.hub.containers, container => container.pos.roomName == this.pos.roomName && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
      //this.sources = this.hub.storage && this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0 ? [this.hub.storage] : containers;

      if (this.hub.storage) {
        this.sources = [this.hub.storage];
      } else {
        this.sources = _.filter(this.hub.containers, container => container.pos.roomName == this.pos.roomName && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
      }


    }

    if (!this.destinations || this.destinations.length == 0) {
      // Reload destination list if empty or not init

      this.destinations = _.filter(this.hub.structures, (structure: { structureType: string, store: StoreDefinition }) => {
        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_LAB ||
          structure.structureType == STRUCTURE_TOWER) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }) as StoreStructure[];
    }
  }

  refresh(): void {
    super.refresh();

    this.sources = undefined;

    log.debug(`Supply init; destinations : ${this.destinations?.length ?? -1}`)

    // this.destinations = undefined;
  }

  init(): void {

    const storage = this.hub.storage;

    if (!storage) {
      return;
    }

    this.spawnSuppliers();

    if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubStorageMaxEnergy && !this.hub.logisticsNetwork.haveRequest(storage, RESOURCE_ENERGY)) {
      this.hub.logisticsNetwork.requestInput(storage, RESOURCE_ENERGY, Settings.hubStorageMaxEnergy);
    }

  }

  run(): void {


    this.autoRun(this.agents, supplier => {

      this.populateStructure();

      const task = SupplierRole.pipeline(this.hub, supplier, this.sources!, this.destinations!);
      if (!task) {
        return [Tasks.wait(new RoomPosition(this.pos.x - 1, this.pos.y + 6, this.pos.roomName))]; // Wait on other position    
      }
      return task;

    });

  }

}