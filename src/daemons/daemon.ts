import { Actor } from "Actor";
import { Agent, AgentSetup, AgentRequestOptions } from "agent/Agent";
import { SpawnRequest } from "area/hub/agent-factory";
import { Hub } from "hub/Hub";
import { log } from "utils/log";
import _ from "lodash";
import { TaskPipeline } from "task/task-pipeline";

export const DEFAULT_PRESPAWN = 50;
export const MAX_SPAWN_REQUESTS = 100;

export abstract class Daemon implements Actor {

  name: string;
  ref: string;
  hub: Hub;
  room: Room;
  pos: RoomPosition;
  memory: Memory | FlagMemory;

  priority: number;

  private _agentByRole?: { [name: string]: Agent[] }; // creeps cache
  agentUsageReport: { [roleName: string]: [number, number] | undefined };

  private lastRefreshTime: number;

  constructor(hub: Hub, initializer: Actor, name: string, priority: number = 100) {
    this.name = name;
    this.ref = `${this.name}:${initializer.ref}`;
    this.hub = hub;
    this.room = initializer.room!;
    this.priority = priority;
    this.pos = initializer.pos;
    this.lastRefreshTime = Game.time;
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

  /*
  protected generateProtoCreep(setup: AgentSetup) {
    const spawner = this.hub.areas.agentFactory;
    if (spawner) {
      spawner.generateProtoCreep(setup, this);
    }
  }
  */

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

  protected wishList(quantity: number, setup: AgentSetup, opts = {} as AgentRequestOptions) {

    /*
    if (this.lifetimeFilter(this.agents(setup.role)).length < quantity && this.hub.areas.agentFactory) {
      this.hub.areas.agentFactory.enqueue(this.generateProtoCreep(setup), priority);
    }
    */

    const creepQuantity = (this.agentsByRole[setup.role] ?? []).length;

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

    _.filter(agents, agent => agent.taskPipelineHandler.empty).forEach(agent => {
      agent.taskPipelineHandler.pipeline = createTasks(agent);
    });

  }

  refresh() {
    this._agentByRole = undefined;
    this.agentUsageReport = {};
  }

  preInit() {
    this.agentUsageReport = _.mapValues(this.agentsByRole, creep => undefined);
  }

  abstract init(): void;

  abstract run(): void;


}