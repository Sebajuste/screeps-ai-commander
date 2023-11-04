import { Actor } from "Actor";
import { Agent, AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, SUPPLY_TEMPLATE } from "agent/agent-setup";
import { SupplierRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import { RESOURCE_IMPORTANCE } from "data/resource";
import { RunActivity } from "hub/Hub";
import _ from "lodash";
import { Settings } from "settings";
import { StoreStructure, Tasks } from "task/task-builder";
import { TaskPipeline } from "task/task-pipeline";
import { log } from "utils/log";

export class SupplyDaemon extends Daemon {


  sources?: StoreStructure[];

  destinations?: StoreStructure[];

  _energyFull: boolean;

  constructor(initializer: Actor) {
    super(initializer.hub, initializer, 'supply', RunActivity.Always);
    this._energyFull = false;
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

    const hasHeavyEnergy = this.hub.extentions.length > 20 && (this.hub.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) > 5000;
    const fullFillRequired = (this.hub.room.energyAvailable / this.hub.room.energyCapacityAvailable) < 0.4;
    const count = hasHeavyEnergy && fullFillRequired ? 2 : 1;

    this.wishList(count, setup, options);

  }

  private populateStructure() {

    if (!this.sources) {

      if (this.hub.storage) {
        this.sources = [this.hub.storage];
      } else {
        this.sources = _.filter(this.hub.containers, container => container.pos.roomName == this.pos.roomName && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
      }

    }

    if (!this.destinations || this.destinations.length == 0) {
      // Reload destination list if empty or not init

      const towerNotHubCenter = this.hub.towers.filter(tower => !this.hub.areas.hubCenter || !this.hub.areas.hubCenter.daemons.router || !this.hub.areas.hubCenter.towers.includes(tower));
      // this.destinations = _.compact([...this.hub.extentions, ...this.hub.spawns, ...this.hub.labs, ...towerNotHubCenter]) as StoreStructure[];

      this.destinations = _.chain([...this.hub.extentions, ...this.hub.spawns, ...this.hub.labs, ...towerNotHubCenter])//
        .compact()//
        .filter((structure: any) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)//
        .value() as StoreStructure[];

      this._energyFull = this.destinations.length == 0;


      /*
      this.destinations = _.filter(this.hub.structures, (structure: any) => {
        const isHubCenterManaged = this.hub.areas.hubCenter && this.hub.areas.hubCenter.daemons.router && this.hub.areas.hubCenter.towers.includes(structure)

        return (structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_LAB ||
          structure.structureType == STRUCTURE_TOWER) &&
          !isHubCenterManaged &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }) as StoreStructure[];
      */
    }
  }

  refresh(): void {
    super.refresh();

    this.sources = undefined;
    this.destinations = undefined;
  }

  init(): void {

    const storage = this.hub.storage;

    if (!storage) {
      // No supply if not storage is present
      return;
    }

    if (this._energyFull && this.hub.spawns.find(spawn => spawn.spawning) != undefined) {
      // TODO : check labs and towers
      this._energyFull = false;
    }

    this.spawnSuppliers();

    if (storage) {
      if (storage.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubStorageMaxEnergy && !this.hub.logisticsNetwork.haveRequest(storage, RESOURCE_ENERGY)) {
        this.hub.logisticsNetwork.requestInput(storage, RESOURCE_ENERGY, Settings.hubStorageMaxEnergy);
      }

      for (const resource of RESOURCE_IMPORTANCE) {
        if (storage.store.getUsedCapacity(resource) < Settings.hubStorageMaxEnergy && !this.hub.logisticsNetwork.haveRequest(storage, resource)) {
          this.hub.logisticsNetwork.requestInput(storage, resource, Settings.hubStorageMaxEnergy);
        }
      }

    }

  }

  endTaskPipeline(supplier: Agent): TaskPipeline {
    const pipeline: TaskPipeline = [];
    if (this.hub.storage && supplier.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Vacuum supplier energy
      pipeline.push(Tasks.transfer(this.hub.storage, RESOURCE_ENERGY));
    }

    pipeline.push(Tasks.wait(new RoomPosition(this.pos.x - 6, this.pos.y, this.pos.roomName), 0)); // Wait on standby position
    return pipeline;
  }

  run(): void {


    this.autoRun(this.agents, supplier => {

      log.debug(`${this.print} create task pipeline for ${supplier.print} this._energyFull: ${this._energyFull}`);

      if (this._energyFull) {
        // No structure require fill
        return this.endTaskPipeline(supplier);
      }

      this.populateStructure();

      if (supplier.store.getUsedCapacity(RESOURCE_ENERGY) == 0 && (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0)) {
        // No energy to fill
        return this.endTaskPipeline(supplier);
      }

      const task = SupplierRole.pipeline(this.hub, supplier, this.sources!, this.destinations!);
      if (!task || task.length == 0) {
        return this.endTaskPipeline(supplier);
      }
      return task;

    });

  }

}