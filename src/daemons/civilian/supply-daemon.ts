import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, SUPPLY_TEMPLATE } from "agent/agent-setup";
import { SupplierRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import _ from "lodash";
import { Settings } from "settings";
import { StoreStructure, Tasks } from "task/task-builder";
import { log } from "utils/log";

export class SupplyDaemon extends Daemon {

  constructor(initializer: Actor) {
    super(initializer.hub, initializer, 'supply');
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

    const count = this.hub.extentions.length > 20 ? 2 : 1;


    if (this.hub.room.energyAvailable < this.hub.room.energyCapacityAvailable) {
      this.wishList(count, setup, options);
    }


  }

  init(): void {
    this.spawnSuppliers();

    const storage = this.hub.storage;

    if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubStorageMaxEnergy && !this.hub.logisticsNetwork.haveRequest(storage, RESOURCE_ENERGY)) {
      log.debug(`${this.print} request input energy to Storage`);
      this.hub.logisticsNetwork.requestInput(storage, RESOURCE_ENERGY, Settings.hubStorageMaxEnergy);
    }

  }

  run(): void {
    const containers = _.filter(this.hub.containers, container => container.pos.roomName == this.pos.roomName && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0);

    const sources = this.hub.storage && this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0 ? [this.hub.storage] : containers;

    const destinations = _.filter(this.hub.structures, (structure: { structureType: string, store: StoreDefinition }) => {
      return (structure.structureType == STRUCTURE_EXTENSION ||
        structure.structureType == STRUCTURE_SPAWN ||
        structure.structureType == STRUCTURE_LAB ||
        structure.structureType == STRUCTURE_TOWER) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }) as StoreStructure[];

    this.autoRun(this.agents, supplier => {
      const task = SupplierRole.pipeline(this.hub, supplier, sources, destinations);
      if (!task) {
        return [Tasks.wait(new RoomPosition(this.pos.x - 1, this.pos.y + 6, this.pos.roomName))]; // Wait on other position    
      }
      return task;

    });

  }

}