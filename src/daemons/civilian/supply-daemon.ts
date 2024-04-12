import { Actor } from "Actor";
import { Agent, AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, SUPPLY_TEMPLATE } from "agent/agent-setup";
import { SupplierRole } from "agent/roles/roles";
import { Daemon } from "daemons";
import { RESOURCE_IMPORTANCE } from "data/resource";
import { RunActivity } from "hub/Hub";
import { bunkerLayout } from "hub/room-planner/bunker-layout";
import { Quadrant, buildQuadrantFillOrder, filterQuadrant } from "hub/room-planner/bunker-room-planner";
import _, { Dictionary } from "lodash";
import { Settings } from "settings";
import { StoreStructure, Tasks } from "task/task-builder";
import { TaskPipeline } from "task/task-pipeline";
import { Coord } from "utils/coord";
import { log } from "utils/log";

export class SupplyDaemon extends Daemon {


  sources?: StoreStructure[];

  destinations?: StoreStructure[];

  _energyFull: boolean;

  quadrantFillOrder: Quadrant;

  activeSupplierCount: number;

  supplierAssignements: Dictionary<string[]>

  constructor(initializer: Actor) {
    super(initializer.hub, initializer, 'supply', RunActivity.Always);
    this._energyFull = false;

    const spawn = this.hub.spawns[0];
    if (spawn) {
      const spawnPos = spawn.pos;
      const bunkerAnchor = new RoomPosition(spawnPos.x - 4, spawnPos.y, spawnPos.roomName);
      console.log('this.hub.roomPlanner: ', this.hub.roomPlanner, ' => ', (this.hub.roomPlanner as any).bunker!)
      this.quadrantFillOrder = buildQuadrantFillOrder(bunkerAnchor, bunkerLayout);
    } else {

      console.log('this.hub.roomPlanner: ', this.hub.roomPlanner, ' => ', (this.hub.roomPlanner as any).bunker!)
      this.quadrantFillOrder = buildQuadrantFillOrder((this.hub.roomPlanner as any).bunker!, bunkerLayout);
    }

    this.computeSupplierAssignment();
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

  private computeSupplierAssignment() {

    console.log("--- computeSupplierAssignment ---")

    const activeSuppliers = _.filter(this.agents, supplier => !supplier.spawning);

    this.activeSupplierCount = activeSuppliers.length;

    if (this.activeSupplierCount > 0) {

      this.populateStructure();

      const quadrantStructures = [
        _.compact(_.map(this.quadrantFillOrder.bottomRight, coord => _.find(this.destinations, dest => dest.pos.x == coord.x && dest.pos.y == coord.y))),
        _.compact(_.map(this.quadrantFillOrder.bottomLeft, coord => _.find(this.destinations, dest => dest.pos.x == coord.x && dest.pos.y == coord.y))),
        _.compact(_.map(this.quadrantFillOrder.topRight, coord => _.find(this.destinations, dest => dest.pos.x == coord.x && dest.pos.y == coord.y))),
        _.compact(_.map(this.quadrantFillOrder.topLeft, coord => _.find(this.destinations, dest => dest.pos.x == coord.x && dest.pos.y == coord.y))),
      ];

      this.supplierAssignements = _.fromPairs(_.map(this.agents, supplier => [supplier.name, []]));

      let index = 0;
      for (const quadrants of quadrantStructures) {
        const supplier = activeSuppliers[index % this.activeSupplierCount];

        //_.extend(assignments[supplier.name], _.fromPairs(_.map(quadrant, s => [s.id, s])));
        this.supplierAssignements[supplier.name] = [...this.supplierAssignements[supplier.name], ..._.map(quadrants, quadrant => quadrant.id)]
        //_.extend(this.supplierAssignements[supplier.name], _.map(quadrants, quadrant => quadrant.id));

        index++;
      }

    }


  }

  private populateStructure() {

    console.log('--- populateStructure ---')

    if (!this.sources) {
      // Refresh sources

      if (this.hub.storage) {
        this.sources = [this.hub.storage];
      } else {
        this.sources = _.filter(this.hub.containers, container => container.pos.roomName == this.pos.roomName); // && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      }
    }

    if (!this.destinations || this.destinations.length == 0) {
      // Reload destination list if empty or not init

      /*
      let towerNotHubCenter: StructureTower[] = [];
      if (this.hub.areas.hubCenter && this.hub.areas.hubCenter.daemons.router) {
        const hubCenter = this.hub.areas.hubCenter;
        towerNotHubCenter = this.hub.towers.filter(tower => !hubCenter.towers.includes(tower) && tower.store.getFreeCapacity(RESOURCE_ENERGY) > 100);
      } else {
        towerNotHubCenter = this.hub.towers.filter(tower => tower.store.getFreeCapacity(RESOURCE_ENERGY) > 100);
      }
      */
      const hubCenter = this.hub.areas.hubCenter;
      // this.hub.towers.filter(tower => hubCenter?.towers.includes(tower))
      const towerNotHubCenter = (hubCenter && hubCenter.daemons.router) ? _.difference(this.hub.towers, hubCenter?.towers) : this.hub.towers;

      // const towerNotHubCenter = this.hub.towers.filter(tower => !this.hub.areas.hubCenter || !this.hub.areas.hubCenter.daemons.router || !this.hub.areas.hubCenter.towers.includes(tower));

      /*
      this.destinations = _.chain([...this.hub.extentions, ...this.hub.spawns, ...this.hub.labs, ...towerNotHubCenter])//
        .compact()//
        // .filter((structure: any) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)//
        .value() as StoreStructure[];
        */

      this.destinations = _.compact([...this.hub.extentions, ...this.hub.spawns, ...this.hub.labs, ...towerNotHubCenter]) as StoreStructure[];

      const fillRequred = _.find(this.destinations, structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
      console.log('> fillRequred: ', fillRequred);
      const hasFillRequired = fillRequred != undefined;
      this._energyFull = !hasFillRequired;

      console.log('> this._energyFull: ', this._energyFull)

    }
  }

  refresh(): void {
    super.refresh();

    console.log(`${this.print} REFRESH`)

    this.sources = undefined;
    this.destinations = undefined;

    if (this.activeSupplierCount != _.filter(this.agents, supplier => !supplier.spawning).length) {
      // Recompute if count of supplier has changed
      this.computeSupplierAssignment();
    }

    console.log('> this.activeSupplierCount: ', this.activeSupplierCount)
    console.log('> this._energyFull: ', this._energyFull)
    console.log('> (Game.time % 10): ', (Game.time % 10))

    if (this.activeSupplierCount == 0 || (this._energyFull && (Game.time % 10) == 0)) {
      // Force update structure if not supplier are available, or each 10 ticks if all should be full
      this.populateStructure();
    }

  }

  init(): void {

    console.log(`${this.print} INIT`)

    const storage = this.hub.storage;

    if (!storage) {
      // No supply if not storage is present
      return;
    }


    if (this._energyFull && this.hub.areas.agentFactory?.spawning) {
      // Even if energy if full, if something is spawning, we must check refelling
      this._energyFull = false;
    }

    if (!this._energyFull) {
      // Spawn supplier only if required
      this.spawnSuppliers();
    }

    if (this.activeSupplierCount == 0 && this.destinations) {
      // Request energy to fill with hauler, if no supplier are presents
      this.destinations.filter(destination => destination.store.getFreeCapacity(RESOURCE_ENERGY) > 0)//
        .forEach(destination => {
          this.hub.logisticsNetwork.requestInput(destination, RESOURCE_ENERGY)
        });
    }

    /**
     * Input request for storage
     */


    if (storage && this.hub.areas.agentFactory && this.hub.areas.agentFactory.daemons.hauler && this.hub.areas.agentFactory.daemons.hauler.ready) {
      // Request logistics only if hauler are available

      if (this.agents.length > 0 && storage.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubStorageMaxEnergy && !this.hub.logisticsNetwork.haveRequest(storage, RESOURCE_ENERGY)) {
        // If supplier are present, AND max energy into the storage is not reach AND not request (input or output) is already done

        const upgradeDaemon = this.hub.areas.upgrade?.daemons.upgrade;

        if (!upgradeDaemon || (upgradeDaemon.store && upgradeDaemon.store.getUsedCapacity(RESOURCE_ENERGY) > upgradeDaemon.store.getCapacity(RESOURCE_ENERGY) / 2)) {
          // Request energy only if no upgrade is available, or if upgrade as enought energy
          this.hub.logisticsNetwork.requestInput(storage, RESOURCE_ENERGY, Settings.hubStorageMaxEnergy);
        }

      }


      for (const resource of RESOURCE_IMPORTANCE) {
        if (storage.store.getUsedCapacity(resource) < Settings.hubStorageMaxEnergy) {
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

    console.log(`${this.print} RUN`)

    console.log('> this._energyFull: ', this._energyFull)


    if (this._energyFull) {
      // Do nothing if energy is full
      return;
    }


    this.autoRun(this.agents, supplier => {

      log.debug(`${this.print} create task pipeline for ${supplier.print} this._energyFull: ${this._energyFull}`);

      if (this._energyFull) {
        // No structure require fill
        return this.endTaskPipeline(supplier);
      }

      if (supplier.store.getUsedCapacity(RESOURCE_ENERGY) == 0 && (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0)) {
        // No energy to fill
        return this.endTaskPipeline(supplier);
      }

      this.populateStructure();

      const destinationIds = this.supplierAssignements[supplier.name]; // this.destinations!

      const destinations = _.compact(_.map(destinationIds, id => _.find(this.destinations, destination => destination.id == id)));

      const task = SupplierRole.pipeline(this.hub, supplier, this.sources!, destinations);
      if (!task || task.length == 0) {
        return this.endTaskPipeline(supplier);
      }
      return task;

    });

  }

}