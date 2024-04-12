import { Actor, ResourceFlowStats } from "Actor";
import { Agent, AgentSetup, AgentRequestOptions } from "agent/Agent";
import { SpawnRequest } from "area/hub/agent-factory";
import { Hub, RunActivity } from "hub/Hub";
import { log } from "utils/log";
import _ from "lodash";
import { TaskPipeline } from "task/task-pipeline";
import { Pathing } from "utils/pathing";

export const DEFAULT_PRESPAWN = 50;
export const MAX_SPAWN_REQUESTS = 100;

export abstract class Daemon implements Actor {

  name: string;
  ref: string;
  hub: Hub;
  room: Room;
  pos: RoomPosition;
  activity: RunActivity;
  hubDistance?: number;
  memory: Memory | FlagMemory;
  resourceFlowStats: ResourceFlowStats;



  priority: number;

  private _agentByRole?: { [name: string]: Agent[] }; // creeps cache
  agentUsageReport: { [roleName: string]: [number, number] | undefined };
  performanceReport: { [stat: string]: number };

  private lastRefreshTime: number;

  constructor(hub: Hub, initializer: Actor, name: string, activity: RunActivity, priority: number = 100) {
    this.name = name;
    this.ref = `${this.name}:${initializer.ref}`;
    this.hub = hub;
    this.room = initializer.room!;
    this.priority = priority;
    this.pos = initializer.pos;
    this.activity = activity;
    this.hubDistance = initializer.memory != undefined ? (initializer.memory as any).hubDistance : undefined;
    this.lastRefreshTime = Game.time;

    this.agentUsageReport = {};
    this.performanceReport = {};
    this.resourceFlowStats = new ResourceFlowStats();
  }

  get reachable(): boolean {
    return Game.rooms[this.pos.roomName] != undefined;
  }

  get agents(): Agent[] {
    return this.hub.agentsByDaemon[this.ref] ? this.hub.agentsByDaemon[this.ref] : [];
  }

  get agentsByRole(): { [name: string]: Agent[] } {

    if (!this._agentByRole || this.lastRefreshTime < Game.time) {
      this._agentByRole = _.groupBy(this.agents, agent => agent.memory.role);
      this.lastRefreshTime = Game.time;
    }
    return this._agentByRole;
  }

  get print(): string {
    return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.ref + ']</a>';
  }

  protected agentReport(role: string, currentAmt: number, neededAmt: number) {
    if (!this.agentUsageReport[role]) {
      this.agentUsageReport[role] = [currentAmt, neededAmt];
    } else {
      const [current, needed]: any = this.agentUsageReport[role];
      this.agentUsageReport[role] = [current + currentAmt, needed + neededAmt]
    }
  }

  protected requestAgent(setup: AgentSetup, opts = {} as AgentRequestOptions) {
    const spawner = this.hub.areas.agentFactory;

    if (spawner) {
      const request: SpawnRequest = {
        setup: setup,
        daemon: this,
        priority: opts.priority ? opts.priority : 0,
      };
      /*
      if (opts.partners) {
        request.partners = opts.partners;
      }
      */
      if (opts.options) {
        request.options = opts.options;
      }
      spawner.enqueue(request);

    } else {
      log.error(`Overseer ${this.ref} @ ${this.name}: no spawner object!`);
      if (Game.time % 100 == 0) {
        log.error(`Overseer ${this.ref} @ ${this.name}: no spawner object!`);
      }
    }

  }

  lifetimeFilter(creeps: (Creep | Agent)[], prespawn = DEFAULT_PRESPAWN, spawnDistance?: number): (Creep | Agent)[] {

    const spawner = this.hub.areas.agentFactory;

    if (!spawnDistance) {

      spawnDistance = 0;

      if (this.hubDistance != undefined) {
        spawnDistance = this.hubDistance;
      }

      /*
      if (this.spawnGroup) {
        const distances = _.take(_.sortBy(this.spawnGroup.memory.distances), 2);
        spawnDistance = (_.sum(distances) / distances.length) || 0;
      } else if (this.hub.areas.agentFactory) {
        // Use distance or 0 (in case distance returns something undefined due to incomplete pathfinding)
        spawnDistance = Pathing.distance(this.pos, this.hub.areas.agentFactory.pos) || 0;
      }
      if (this.hub.isIncubating && this.hub.spawnGroup) {
        spawnDistance += this.hub.spawnGroup.stats.avgDistance;
      }
      */
    }

    return _.filter(creeps, creep =>
      creep.ticksToLive! > CREEP_SPAWN_TIME * creep.body.length + spawnDistance! + prespawn ||
      creep.spawning ||
      (!creep.spawning && !creep.ticksToLive) // See: https://screeps.com/forum/topic/443/creep-spawning-is-not-updated-correctly-after-spawn-process
    );
  }

  protected wishList(quantity: number, setup: AgentSetup, opts = {} as AgentRequestOptions) {

    let creepQuantity;

    if (opts.noLifetimeFilter) {
      creepQuantity = this.lifetimeFilter(this.agentsByRole[setup.role] ?? [], opts.prespawn).length;
    } else {
      creepQuantity = (this.agentsByRole[setup.role] ?? []).length;
    }

    // log.debug(`${this.print} wishList creepQuantity: ${creepQuantity}`);

    const spawnQuantity = quantity - creepQuantity;

    if (spawnQuantity > 0) {

      if (spawnQuantity > MAX_SPAWN_REQUESTS) {
        log.warning(`Too many requests for ${setup.role}s submitted by ${this.name}! (Check for errors.)`);
      } else {
        for (let i = 0; i < spawnQuantity; i++) {
          this.requestAgent(setup, opts);
        }
      }
    }
    this.agentReport(setup.role, creepQuantity, quantity);
  }


  protected autoRun(agents: Agent[], createTasks: (agent: Agent) => TaskPipeline) {

    if (!agents || agents.length == 0) {
      return;
    }

    _.filter(agents, agent => agent.taskPipelineHandler.empty && !agent.creep.spawning).forEach(agent => {
      agent.taskPipelineHandler.pipeline = createTasks(agent);
    });

  }

  refresh() {
    this._agentByRole = undefined;
    this.agentUsageReport = {};
    this.performanceReport = {};
    this.resourceFlowStats.clear();
    this.room = Game.rooms[this.room.name];
  }

  preInit() {
    this.agentUsageReport = _.mapValues(this.agentsByRole, creep => undefined);
  }

  abstract init(): void;

  abstract run(): void;


}