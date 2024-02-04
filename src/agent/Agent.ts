import { SpawnRequestOptions } from "area/hub/agent-factory";
import { Task } from "../task/Task";
import { TaskInfo, deserializeTasks, serializeTasks } from "../task/task-initializer";
import { Mem } from "memory/Memory";
import { CPU } from "cpu/CPU";
import { log } from "utils/log";
import { printCreep } from "utils/creep-utils";
import { OK_PIPELINE_READY, TaskPipeline, TaskPipelineHandler } from "task/task-pipeline";
import { PROCESS_PRIORITY_LOW, pushProcess } from "cpu/process";
import { Hub } from "hub/Hub";
import { Settings } from "settings";


export interface AgentSetup {
  role: string;
  bodyParts: BodyPartConstant[],
}

export interface AgentRequestOptions {
  reassignIdle?: boolean;
  noLifetimeFilter?: boolean;
  prespawn?: number;
  priority?: number;
  options?: SpawnRequestOptions;
}

export interface AgentMemory extends CreepMemory {
  hub: string;
  daemon: string;
  role: string;
  taskInfos: TaskInfo[];
  lastRunTick?: number;
};

const DEFAULT_AGENT_MEMORY = {

};

export class Agent {

  creep: Creep;
  memory: AgentMemory;

  taskPipelineHandler: TaskPipelineHandler;

  runCount: number;

  constructor(creep: Creep) {
    this.creep = creep;
    this.memory = this.creep.memory as AgentMemory;
    this.taskPipelineHandler = new TaskPipelineHandler(this.creep);
    this.runCount = 0;
  }

  get lastRunTick(): number {
    return this.memory.lastRunTick ?? Game.time;
  }

  set lastRunTick(v: number) {
    this.memory.lastRunTick = v;
  }

  get spawning(): boolean {
    return this.creep.spawning;
  }

  get ticksToLive(): number | undefined {
    return this.creep.ticksToLive;
  }

  get id(): Id<Creep> {
    return this.creep.id;
  }

  get name(): string {
    return this.creep.name;
  }

  get store(): StoreDefinition {
    return this.creep.store;
  }

  get pos(): RoomPosition {
    return this.creep.pos;
  }

  get room(): Room {
    return this.creep.room;
  }

  get body() {
    return this.creep.body;
  }

  get hits() {
    return this.creep.hits;
  }

  get hitsMax() {
    return this.creep.hitsMax;
  }

  get print(): string {
    return `<a href="#!/room/${Game.shard.name}/${this.pos.roomName}">[${this.name}@${this.pos.roomName}, x:${this.pos.x},y${this.pos.y}:]</a>`;
  }

  private internalRun(hub: Hub) {
    this.lastRunTick = Game.time;

    const result = this.taskPipelineHandler.run();

    if (this.runCount++ >= Settings.creepMaxTaskRun) {
      log.warning(`${this.print} too much run for this tick`);
      return;
    }

    if (result == OK_PIPELINE_READY) {
      // Other task should be run into the same tick
      this.run(hub);
      /*
      pushProcess(hub.processStack, () => {
        const start = Game.cpu.getUsed();
        this.run(hub);
        const timeElasped = Game.cpu.getUsed() - start;
        hub.creepCPU += timeElasped;
      }, PROCESS_PRIORITY_LOW);
      */
    }
  }

  haveBodyPart(bodyPart: string) {
    for (const index in this.body) {
      const item = this.body[index];
      if (item.type === bodyPart && item.hits > 0) {
        return true;
      }
    }
    return false;
  }

  refresh() {
    if (!this.taskPipelineHandler) {
      this.taskPipelineHandler = new TaskPipelineHandler(this.creep);
    }
    this.runCount = 0;
  }



  run(hub: Hub) {

    pushProcess(hub.processStack, () => {
      const start = Game.cpu.getUsed();
      this.internalRun(hub);
      const timeElasped = Game.cpu.getUsed() - start;
      hub.creepCPU += timeElasped;
    }, PROCESS_PRIORITY_LOW);

    /*
    this.lastRunTick = Game.time;

    const result = this.taskPipelineHandler.run();

    if (this.runCount++ >= Settings.creepMaxTaskRun) {
      log.warning(`${this.print} too much run for this tick`);
      return;
    }

    if (result == OK_PIPELINE_READY) {
      // Other task should be run into the same tick
      pushProcess(hub.processStack, () => {
        const start = Game.cpu.getUsed();
        this.run(hub);
        const timeElasped = Game.cpu.getUsed() - start;
        hub.creepCPU += timeElasped;
      }, PROCESS_PRIORITY_LOW);
    }
    */

  }

}