import { AgentSetup } from "agent/Agent";
import { bodyCost } from "agent/agent-builder";
import { Area } from "area/Area";
import { Daemon, HaulerDaemon } from "daemons";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { Settings } from "settings";
import { log } from "utils/log";
import { exponentialMovingAverage } from "utils/stats";


const ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH = -20;
const ERR_SPECIFIED_SPAWN_BUSY = -21;

export interface SpawnRequestOptions {
  spawn?: StructureSpawn;				    // allows you to specify which spawn to use; only use for high priority
  directions?: DirectionConstant[];	// StructureSpawn.spawning.directions
  memory?: any;
}

export interface SpawnRequest {
  setup: AgentSetup;					// creep body generator to use
  daemon: Daemon;					    // Daemon requesting the creep
  priority: number;					  // priority of the request // TODO: WIP
  //partners?: CreepSetup[];			// partners to spawn along with the creep
  options?: SpawnRequestOptions;		// options
}

interface ProtoCreep {
  name: string;
  body: BodyPartConstant[];
  memory: CreepMemory;
}

interface SpawnOrder {
  protoCreep: ProtoCreep;
  options?: SpawnRequestOptions; // SpawnOptions
}

export class AgentFactoryArea extends Area {

  spawns: StructureSpawn[];
  availableSpawns: StructureSpawn[];        // Filled by refresh
  extensions: StructureExtension[];         // Filled by refresh

  daemons: {
    hauler: HaulerDaemon
  };

  private _nextAvailability: number | undefined;
  private productionPriorities: number[];
  private productionQueue: {								// Prioritized spawning queue
    [priority: number]: SpawnOrder[]
  };

  private isOverloaded: boolean;

  constructor(hub: Hub, instantiationObject: RoomObject) {
    super(hub, instantiationObject, 'agent_factory_area');

    this.memory = Mem.wrap(this.hub.memory, 'agentFactory', {});

    this.build();
  }

  get nextAvailability(): number {
    if (!this._nextAvailability) {
      const allQueued = _.flatten(_.values(this.productionQueue)) as SpawnOrder[];
      // const queuedSpawnTime = _.sum(allQueued, order => order.protoCreep.body.length) * CREEP_SPAWN_TIME;
      const queuedSpawnTime = allQueued.reduce((sum, order) => sum + order.protoCreep.body.length, 0) * CREEP_SPAWN_TIME;
      // const activeSpawnTime = _.sum(this.spawns, spawn => spawn.spawning ? spawn.spawning.remainingTime : 0);
      const activeSpawnTime = this.spawns.reduce((sum, spawn) => spawn.spawning ? spawn.spawning.remainingTime : 0, 0);
      this._nextAvailability = (activeSpawnTime + queuedSpawnTime) / this.spawns.length;
    }
    return this._nextAvailability;
  }

  private populateStructure() {
    this.spawns = this.hub.spawns;
    this.availableSpawns = _.filter(this.spawns, spawn => !spawn.spawning);
    this.extensions = _.filter(this.hub.structures, structure => structure.structureType == STRUCTURE_EXTENSION) as StructureExtension[];
  }

  private build() {
    this.spawns = this.hub.spawns;
    this.isOverloaded = false;
    this.productionPriorities = [];
    this.productionQueue = {};
    this.populateStructure();
  }

  generateProtoCreep(setup: AgentSetup, daemon: Daemon, memory?: any): ProtoCreep {
    // Generate the creep body
    // let creepBody: BodyPartConstant[];
    // if (overlord.colony.incubator) { // if you're being incubated, build as big a creep as you want
    // 	creepBody = setup.generateBody(overlord.colony.incubator.room.energyCapacityAvailable);
    // } else { // otherwise limit yourself to actual energy constraints
    // creepBody = creep_builder.select_body_parts(this.room.energyCapacityAvailable);

    // }
    // Generate the creep memory
    const creepMemory: CreepMemory = {
      hub: daemon?.hub.name,
      daemon: daemon?.ref,
      //[_MEM.COLONY]  : overlord.colony.name, 				// name of the colony the creep is assigned to
      //[_MEM.OVERLORD]: overlord.ref,						// name of the Overlord running this creep
      role: setup.role,						// role of the creep
      // tasks: [], 								// task the creep is performing
      /*
      data: { 									// rarely-changed data about the creep
        origin: '',										// where it was spawned, filled in at spawn time
      },
      */
    };
    // Create the protocreep and return it
    const protoCreep = { 							// object to add to spawner queue
      body: setup.bodyParts, 										// body array
      name: setup.role, 									// name of the creep - gets modified by hatchery
      memory: memory ? (_.defaults(memory, creepMemory)) : creepMemory,									// memory to initialize with
    } as ProtoCreep;
    return protoCreep;
  }

  private spawnAgent(protoCreep: ProtoCreep, options: SpawnRequestOptions = {}): number {
    // get a spawn to use
    let spawnToUse: StructureSpawn | undefined;
    if (options.spawn) {
      spawnToUse = options.spawn;
      if (spawnToUse.spawning) {
        return ERR_SPECIFIED_SPAWN_BUSY;
      } else {
        _.remove(this.availableSpawns, spawn => spawn.id == spawnToUse!.id); // mark as used
      }
    } else {
      spawnToUse = this.availableSpawns.shift();
    }
    if (spawnToUse) { // if there is a spawn, create the creep

      if (this.hub.areas.hubCenter && this.hub.areas.hubCenter.coreSpawn && spawnToUse.id == this.hub.areas.hubCenter.coreSpawn.id && !options.directions) {
        options.directions = [LEFT, TOP]; // don't spawn into the router spot
      }

      protoCreep.name = `${protoCreep.name}/${Game.time}`; // modify the creep name to make it unique
      if (bodyCost(protoCreep.body) > this.room.energyCapacityAvailable) {
        return ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH;
      }
      //protoCreep.memory.data.origin = spawnToUse.pos.roomName;

      const result = spawnToUse.spawnCreep(protoCreep.body, protoCreep.name, {
        memory: protoCreep.memory,
        // energyStructures: this.energyStructures,
        directions: options.directions
      });
      // const result = OK;
      if (result == OK) {
        return result;
      } else {
        this.availableSpawns.unshift(spawnToUse); // return the spawn to the available spawns list
        return result;
      }
    } else { // otherwise, return busy
      return ERR_BUSY;
    }
  }

  private spawnHighestPriorityAgent(): number | undefined {
    const sortedKeys = _.sortBy(this.productionPriorities);

    for (const priority of sortedKeys) {

      // if (this.hub.defcon >= DEFCON.playerInvasion
      // 	&& !this.hub.controller.safeMode
      // 	&& priority > OverlordPriority.warSpawnCutoff) {
      // 	continue; // don't spawn non-critical creeps during wartime
      // }

      const nextOrder = this.productionQueue[priority].shift();
      if (nextOrder) {

        const { protoCreep, options } = nextOrder;
        const result = this.spawnAgent(protoCreep, options);
        if (result == OK) {
          return result;
        } else if (result == ERR_SPECIFIED_SPAWN_BUSY) {
          return result; // continue to spawn other things while waiting on specified spawn
        } else {
          // If there's not enough energyCapacity to spawn, ignore it and move on, otherwise block and wait
          if (result != ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH) {
            this.productionQueue[priority].unshift(nextOrder);
            return result;
          }
        }
      }
    }
  }

  private handleEnergyRequests(): void {

    const refillSpawns = _.filter(this.spawns, spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    refillSpawns.forEach(spawn => this.hub.logisticsNetwork.requestInput(spawn, RESOURCE_ENERGY));

    const refillExtensions = _.filter(this.extensions, extension => extension.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    refillExtensions.forEach(extension => this.hub.logisticsNetwork.requestInput(extension, RESOURCE_ENERGY));

  }

  private handleSpawns(): void {

    // Spawn all queued creeps that you can
    while (this.availableSpawns.length > 0) {
      const result = this.spawnHighestPriorityAgent();

      if (result == ERR_NOT_ENOUGH_ENERGY) { // if you can't spawn something you want to
        this.isOverloaded = true;
      }
      if (result != OK && result != ERR_SPECIFIED_SPAWN_BUSY) {
        // Can't spawn creep right now
        break;
      }
    }

    // Move creeps off of exit position to let the spawning creep out if necessary
    /*
    for (const spawn of this.spawns) {
      if (spawn.spawning && spawn.spawning.remainingTime <= 1 && spawn.pos.findInRange(FIND_MY_CREEPS, 1).length > 0) {
        let directions: DirectionConstant[];
        if (spawn.spawning.directions) {
          directions = spawn.spawning.directions;
        } else {
          directions = _.map(spawn.pos.availableNeighbors(true), pos => spawn.pos.getDirectionTo(pos));
        }
        const exitPos = Pathing.positionAtDirection(spawn.pos, _.first(directions)) as RoomPosition;
        Movement.vacatePos(exitPos);
      }
    }
    */
  }

  private recordStats() {
    // Compute uptime and daemons status

    const spawnUsageThisTick = _.filter(this.spawns, spawn => spawn.spawning).length / this.spawns.length;
    const uptime = exponentialMovingAverage(spawnUsageThisTick, this.memory.stats?.uptime, CREEP_LIFE_TIME);
    const longUptime = exponentialMovingAverage(spawnUsageThisTick, this.memory.stats?.longUptime, 5 * CREEP_LIFE_TIME);
    const daemons = exponentialMovingAverage(this.isOverloaded ? 1 : 0, this.memory.stats?.overload, CREEP_LIFE_TIME);

    this.memory.stats = { daemons, uptime, longUptime };
  }

  canSpawn(body: BodyPartConstant[]): boolean {
    return bodyCost(body) <= this.room.energyCapacityAvailable;
  }

  enqueue(request: SpawnRequest): void {

    const protoCreep = this.generateProtoCreep(request.setup, request.daemon, request.options?.memory);

    const priority = request.priority;
    if (this.canSpawn(protoCreep.body) && protoCreep.body.length > 0) {
      // Spawn the creep yourself if you can
      this._nextAvailability = undefined; // invalidate cache
      // this._queuedSpawnTime = undefined;
      if (!this.productionQueue[priority]) {
        this.productionQueue[priority] = [];
        this.productionPriorities.push(priority); // this is necessary because keys interpret number as string
      }
      const order = {
        protoCreep: protoCreep,
        options: request.options
      } as SpawnOrder;
      this.productionQueue[priority].push(order);
    } else {
      log.error(`${this.room.name}: cannot spawn creep ${protoCreep.name} with body ` + `${JSON.stringify(protoCreep.body)}! Request : ${JSON.stringify(request)}`);
    }
  }

  spawnDaemons(): void {

    this.daemons.hauler = new HaulerDaemon(this.hub, this, Settings.hubMaxHauler);

  }

  refresh() {
    super.refresh();

    this.isOverloaded = false;
    this.productionPriorities = [];
    this.productionQueue = {};

    this.populateStructure();
  }

  init(): void {
    if (!this.hub.storage || (this.hub.areas.hubCenter?.daemons.supply.agents.length ?? 0) == 0) {
      // Direct request only if no storage or supplyer are available. Otherwise supply is in charge on it
      this.handleEnergyRequests();
    }

    this.daemons.hauler.maxQuantity = Math.max(1, this.hub.sources.length - (this.hub.links.length - 2));
  }

  run(): void {
    this.handleSpawns();
    this.recordStats();
  }

}