import { log } from "utils/log";
import { Task } from "./Task";
import { deserializeTasks, serializeTasks } from "./task-initializer";
import { printCreep } from "utils/creep-utils";
import _ from "lodash";


const MAX_RUN = 2;

export type TaskPipeline = Task[];

// export type TaskPipelineFactory = () => TaskPipeline;

/**
 * Next task should be run in the current tick
 */
export const OK_PIPELINE_READY = 1;
export const ERR_PIPELINE_EMPTY = -100;
export const ERR_PIPELINE_INVALID_TASK = -99;
export const ERR_PIPELINE_INVALID_CONFIG = -98;
export const ERR_PIPELINE_MAX_RUN = -98;

export class TaskPipelineHandler {

  creep: Creep;

  _pipeline?: TaskPipeline;

  lastTick: number;
  runCount: number;

  constructor(creep: Creep) {
    this.creep = creep;
    this.lastTick = Game.time;
    this.runCount = 0;
  }

  get pipeline() {
    if (!this._pipeline) {
      this.restorePipeline();
    }
    return this._pipeline as TaskPipeline;
  }

  set pipeline(value: TaskPipeline) {
    this._pipeline = value;
    this.savePipeline();
  }

  get empty(): boolean {
    return this.pipeline.length == 0;
  }

  private restorePipeline() {
    const creepMemory: any = this.creep.memory;
    return this._pipeline = deserializeTasks(creepMemory['taskInfos'] ?? []);
  }

  private savePipeline() {
    if (this.pipeline.length > 0) {
      // Save current pipeline change into memory
      (this.creep.memory as any)['taskInfos'] = serializeTasks(this.pipeline);
    } else {
      delete (this.creep.memory as any)['taskInfos'];
    }
  }

  clear() {
    this.pipeline = [];
  }

  run(): number {

    if (Game.time != this.lastTick) {
      this.lastTick = Game.time;
      this.runCount = 0;
    }

    if (this.runCount++ >= MAX_RUN) {
      log.warning(`${printCreep(this.creep)} Max pipeline loop run reached`);
      return ERR_PIPELINE_MAX_RUN;
    }

    /*
    if (!this.factory) {
      log.error(`${printCreep(creep)} No factory to create new pipeline task`);
      return ERR_PIPELINE_INVALID_CONFIG;
    }
    */

    if (this.empty) {
      // Load pipeline from memory if required
      this.restorePipeline();
    }

    if (this.empty) {
      return ERR_PIPELINE_EMPTY;
    }

    if (!this.empty) {
      // Run pipeline
      const nextTask = _.first(this.pipeline);
      if (nextTask) {
        if (nextTask.run(this.creep)) {
          // Action finished

          // log.debug(`${printCreep(this.creep)} task finished [${nextTask.name}], pipeline: ${this.pipeline.length}`);

          this.pipeline.shift(); // Remove the finished task

          // Save current pipeline change into memory
          this.savePipeline();

          if (!this.empty) {
            // Other action is available
            return OK_PIPELINE_READY;
          }
          /*
          else {
            // Pipeline is empty
            this.pipeline = this.factory();
            this.savePipeline(creep);

            if (!this.empty) {

              if (this.pipeline[0].name == nextTask.name) {
                // New task is the same that old one
                return OK;
              }

              // Other action is available
              return OK_PIPELINE_READY;
            } else {
              return ERR_PIPELINE_EMPTY;
            }

          }
          */
          return ERR_PIPELINE_EMPTY;

        } else {
          // Current task must be run next tick
          return OK;
        }
      } else {
        return ERR_PIPELINE_INVALID_TASK;
      }
    } else {
      // Cannot get pipeline
      log.warning(`${printCreep(this.creep)} No task ready`);
      return ERR_PIPELINE_EMPTY;
    }

  }

}