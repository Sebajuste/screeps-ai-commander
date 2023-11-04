
import _ from "lodash";
import { Agent } from "agent/Agent";
import { HaulerRole } from "agent/roles/roles";
import { Hub } from "hub/Hub";
import { EnergyStructure, StoreStructure, isResource, isRoomPosition, isStoreStructure, isTombstone } from "task/task-builder";
import { GaleShapley, GaleShapleyPreference } from "utils/gale-shapley";
import { log } from "utils/log";
import { getMultiRoomRange } from "utils/util-pos";



export type LogisticsTarget =
  EnergyStructure
  | StoreStructure
  | StructureLab
  | StructureNuker
  | StructurePowerSpawn
  | StructureTerminal
  | Tombstone
  | Resource<ResourceConstant>;

/*
type HaulerCache = {
[transporterName: string]: {
  nextAvailability: [number, RoomPosition],
  predictedTransporterCarry: StoreDefinition,
  tick: number,
}
};
*/

interface LogisticsNetworkCache {
  nextAvailabilities: { [haulerName: string]: [number, RoomPosition] },
  resourceChangeRate: { [requestID: string]: { [haulerName: string]: number } },
}

/*
interface LogisticsNetworkMemory {
  haulers: HaulerCache;
}

const DEFAULT: LogisticsNetworkMemory = {
  haulers: {},
};
*/

export interface LogisticsRequest {
  id: string;
  target: LogisticsTarget,
  amount: number,
  resourceType: ResourceConstant;
}

type HaulerPreference = { [creepID: string]: LogisticsRequest[] };
type RequestPreference = { [requestID: string]: Agent[] };
type Match = { [hauler: string]: LogisticsRequest };


export class LogisticsNetwork {

  static Settings = {
    minimumTickInterval: 5
  };

  hub: Hub;

  private requests: LogisticsRequest[];

  private _match?: Match;
  private _nextProcessTick: number;

  private _transporters?: Agent[];

  private cache: LogisticsNetworkCache;

  static settings = {
    flagDropAmount: 1000,
    rangeToPathHeuristic: 1.1, 	// findClosestByRange * this ~= findClosestByPos except in pathological cases
    carryThreshold: 800, 	// only do stable matching on transporters at least this big (RCL4+)
    droppedEnergyThreshold: 200,	// ignore dropped energy below this amount
  };

  constructor(hub: Hub) {
    this.hub = hub;
    // this.memory = Mem.wrap(colony.memory, 'logistics', DEFAULT);

    this.requests = [];
    // this._match = {};
    this._nextProcessTick = Game.time;

    this.cache = {
      nextAvailabilities: {},
      resourceChangeRate: {}
    };
  }

  get transporters(): Agent[] {
    if (!this._transporters) {
      this._transporters = _.filter(this.hub.agentsByRole['hauler'] ?? [], hauler => hauler.haveBodyPart(CARRY));
    }
    return this._transporters;
  }

  private computeNextAvailabity(hauler: Agent): [number, RoomPosition] {

    if (hauler.taskPipelineHandler.pipeline.length > 0) {
      const task = hauler.taskPipelineHandler.pipeline[0];
      const targetPos = task.target.pos;
      let distance = task.eta(hauler.creep);
      if (distance && targetPos && isRoomPosition(targetPos)) {
        distance += Math.ceil(getMultiRoomRange(hauler.pos, targetPos) * LogisticsNetwork.settings.rangeToPathHeuristic);
        return [distance, targetPos];
      } else {
        return [0, hauler.pos];
      }

    } else {
      return [0, hauler.pos];
    }
  }

  private nextAvailability(hauler: Agent) {
    if (!this.cache.nextAvailabilities[hauler.name]) {
      this.cache.nextAvailabilities[hauler.name] = this.computeNextAvailabity(hauler);
    }
    return this.cache.nextAvailabilities[hauler.name];
  }

  private matchingGaleShapley(haulerPreference: HaulerPreference, requestPreference: RequestPreference): Match | undefined {

    const haulerPref: GaleShapleyPreference = {};
    const requestPref: GaleShapleyPreference = {};

    _.keys(haulerPreference).forEach(haulerID => {
      haulerPref[haulerID] = _.map(haulerPreference[haulerID], request => request.id);
    });

    _.keys(requestPreference).forEach(reqID => {
      requestPref[reqID] = _.map(requestPreference[reqID], hauler => hauler.id);
    });

    const galeShapley = new GaleShapley(haulerPref, requestPref);

    const result = galeShapley.matching();

    return _.mapValues(result, reqID => _.find(this.requests, req => req.id == reqID) as LogisticsRequest);
  }

  private requestHaulerScore(request: LogisticsRequest, hauler: Agent): number {

    if (!this.cache.resourceChangeRate[request.id]) {
      this.cache.resourceChangeRate[request.id] = {};
    }

    if (!this.cache.resourceChangeRate[request.id][hauler.name]) {

      const [ticksUntilFree, newPos] = this.nextAvailability(hauler);

      const amount = Math.abs(request.amount);

      const isTake = request.amount < 0;

      // Take value OR put value
      const carry = isTake ? (hauler.store.getFreeCapacity(request.resourceType) ?? 0) : (hauler.store.getUsedCapacity(request.resourceType) ?? 0);

      try {
        const distance = Math.max(1.0, ticksUntilFree + getMultiRoomRange(newPos, request.target.pos) * LogisticsNetwork.settings.rangeToPathHeuristic);

        const dq = Math.min(amount, carry);
        const dt = 1.0 / distance;

        this.cache.resourceChangeRate[request.id][hauler.name] = dq * dt;

      } catch (err) {
        log.error(`${this.hub.print} newPos: ${newPos}, request.target.pos: ${request.target.pos}, hauler.task?.targetPos: ${Object.keys(hauler.taskPipelineHandler.pipeline[0]?.target ?? {})}`)
        log.error((err as any)['stack'])
        return 0;
      }
    }

    return this.cache.resourceChangeRate[request.id][hauler.name];
  }

  private getInputAmount(target: LogisticsTarget, resourceType: ResourceConstant, amount?: number): number {

    if (isResource(target)) {
      return 0; // Invalid fill droped resource
    } else if (isTombstone(target)) {
      const capacity = target.store.getFreeCapacity(resourceType) ?? 0;
      return amount != undefined ? Math.min(amount, capacity) : capacity;
    } else if (isStoreStructure(target)) {
      const capacity = target.store.getFreeCapacity(resourceType) ?? 0;
      return amount != undefined ? Math.min(amount, capacity) : capacity;
    }
    return 0;
  }

  private getOutputAmount(target: LogisticsTarget, resourceType: ResourceConstant, amount?: number): number {

    if (isResource(target)) {
      return target.amount;
    } else if (isTombstone(target)) {
      const capacity = target.store.getUsedCapacity(resourceType) ?? 0;
      return amount != undefined ? Math.min(amount, capacity) : capacity;
    } else if (isStoreStructure(target)) {
      const capacity = target.store.getUsedCapacity(resourceType) ?? 0;
      return amount != undefined ? Math.min(amount, capacity) : capacity;
    }
    return 0;
  }

  private processMatch(): Match | undefined {

    if (Game.time < this._nextProcessTick) {
      return;
    }

    const startTime = Date.now();
    let startCPU = Game.cpu.getUsed();

    let haulersPreferences: HaulerPreference = {};
    let requestPreferences: RequestPreference = {};

    /**
     * Clean Outputs if no inputs exists with the resource
     */
    const inputResources = _.chain(this.requests)//
      .filter(req => req.amount > 0) // Filter Inputs
      .map(request => request.resourceType)//
      .compact().uniq()// Clean result
      .value();

    _.remove(this.requests, request => request.amount < 0 && !inputResources.includes(request.resourceType)); // Remove unreachable Outputs

    try {

      _.forEach(this.transporters, hauler => {
        haulersPreferences[hauler.id] = _.chain(this.requests)//
          .filter(request => this.requestHaulerScore(request, hauler) > 0)//
          .orderBy((request: LogisticsRequest) => this.requestHaulerScore(request, hauler), ['desc'])//
          .value();
      });

      _.forEach(this.requests, request => {
        requestPreferences[request.id] = _.chain(this.transporters)//
          .filter(hauler => this.requestHaulerScore(request, hauler) > 0)//
          .orderBy((hauler: Agent) => this.requestHaulerScore(request, hauler), ['desc'])//
          .value();
      });

      const result = this.matchingGaleShapley(haulersPreferences, requestPreferences) ?? {};

      const elapsedTime = Date.now() - startTime;
      const elapsedCPU = Game.cpu.getUsed() - startCPU;

      log.info(`${this.hub.print} LogisticNetworks run into ${elapsedTime} ms for ${elapsedCPU} CPU`);

      this._nextProcessTick = Game.time + LogisticsNetwork.Settings.minimumTickInterval;

      return result;

    } catch (err: any) {
      log.fatal(err, err.stack);
    }

  }

  /**
   * Update the task role for transporters
   * @param transporters 
   */
  private applyTask(transporters: string[]) {

    const agents = _.chain(transporters)//
      .map(haulerID => _.find(this.transporters, h => h.id == haulerID))//
      .compact()//
      .value() as Agent[];

    agents.forEach((transporter: Agent) => {
      const request = this.match[transporter.id];
      if (request) {
        transporter.taskPipelineHandler.pipeline = HaulerRole.pipeline(this.hub, transporter, request);
      }
    });

  }

  get match(): Match {
    if (!this._match) {
      this._match = this.processMatch();
    }
    return this._match ?? {};
  }

  inputRequest(): number {
    return _.fill(this.requests, (req: LogisticsRequest) => req.amount > 0).length;
  }

  outputRequest(): number {
    return _.fill(this.requests, (req: LogisticsRequest) => req.amount < 0).length;
  }

  haveRequest(target: LogisticsTarget, resourceType: ResourceConstant = RESOURCE_ENERGY): boolean {

    return this.requests.find(req => (req.target.id == target.id || req.target.pos.isEqualTo(target.pos)) && req.resourceType == resourceType) != undefined;

  }

  requestDrop(pos: RoomPosition, resourceType: ResourceConstant = RESOURCE_ENERGY, amount: number = 1000) {

    if (this.requests.find(req => (req.target.pos.isEqualTo(pos)) && req.resourceType == resourceType) != undefined) {
      log.warning(`${this.hub.print} Drop logistic already registered with resource ${resourceType} at ${pos}`);
      return;
    }

    const req = {
      id: `${Math.floor(Math.random() * 10000)}`,
      target: { pos },
      amount: amount,
      resourceType: resourceType
    } as LogisticsRequest;

    this.requests.push(req);

    // log.debug(`${this.hub.print} Input drop logistic for resource ${resourceType} at `, pos);

  }

  requestInput(target: LogisticsTarget, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {

    // if (this.requests.find(req => req.target.id == target.id && req.resourceType == resourceType)) {
    if (this.haveRequest(target, resourceType)) {
      log.warning(`${this.hub.print} Input logistic already registered with resource ${resourceType} for target ${target} at ${target.pos}`);
      return;
    }

    const req = {
      id: `${Math.floor(Math.random() * 10000)}`,
      target: target,
      amount: this.getInputAmount(target, resourceType, amount),
      resourceType: resourceType
    } as LogisticsRequest;

    if (req.amount != 0) {
      this.requests.push(req);
      // log.debug(`${this.hub.print} logistic request input ${resourceType} for target ${target} at ${target.pos}`);
    }
  }

  requestOutput(target: LogisticsTarget, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {

    if (this.haveRequest(target, resourceType)) {
      log.warning(`${this.hub.print} Output logistic already registered with resource ${resourceType} for target ${target} at ${target.pos}`);
      return;
    }

    const req = {
      id: `${Math.floor(Math.random() * 10000)}`,
      target: target,
      amount: -this.getOutputAmount(target, resourceType, amount),
      resourceType: resourceType
    } as LogisticsRequest;

    if (req.amount != 0) {
      this.requests.push(req);
      // log.debug(`${this.hub.print} logistic request output ${resourceType} for target ${target} at ${target.pos}`);
    }
  }

  removeRequest(target: LogisticsTarget, resourceType: ResourceConstant = RESOURCE_ENERGY) {

    const req = _.find(this.requests, req => (req.target.id == target.id || req.target.pos.isEqualTo(target.pos)) && req.resourceType == resourceType);

    if (req) {
      _.remove(this.requests, it => it == req);
    }
  }

  /**
   * Get the logistic request for the specified transporter.
   * If the math is compute, set automaticaly the new task for all other transporter.
   * 
   * @param transporter 
   * @returns 
   */
  getLogisticsRequest(transporter: Agent): LogisticsRequest | undefined {

    if (this.transporters.length == 1) {
      // Shortcut algorithm if only one transporter is available

      const bestRequest = _.chain(this.requests)//
        .orderBy(request => this.requestHaulerScore(request, transporter), ['desc'])//
        .first()//
        .value();

      return bestRequest;
    }

    const needToUpdateHaulerTask = this._match == undefined;

    const result = this.match[transporter.id];

    if (needToUpdateHaulerTask) {
      // Update all other pawn task
      const transporters = _.filter(Object.keys(this.match), h => h != transporter.id);
      this.applyTask(transporters);
    }

    return result;
  }

  refresh() {

    this.requests = [];

    this._match = undefined;

    this._transporters = undefined;

    this.cache = {
      nextAvailabilities: {},
      resourceChangeRate: {}
    };
  }

  ressourceCount(): number {

    const inputResources = _.chain(this.requests)//

      .groupBy('resourceType')// Regroup By resource
      .filter(requests => _.find(requests, req => req.amount > 0) != undefined)// Filter Inputs
      .map(requests => _.first(requests)?.resourceType ?? null)// Get resource name

      //.filter(req => req.amount > 0) //
      //.map(req => req.resourceType)//

      .compact()// Clean result
      .value();

    const logisticResources = _.filter(this.requests, request => !inputResources.includes(request.resourceType));

    const group = _.groupBy(logisticResources, 'resourceType');

    return Object.keys(group).length;

  }

}