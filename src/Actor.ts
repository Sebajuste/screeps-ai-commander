import { Hub } from "./hub/Hub";



export interface Actor {
  name: string;
  ref: string;
  hub: Hub;
  room: Room;
  pos: RoomPosition;
  memory: Memory | FlagMemory;
  performanceReport: { [stat: string]: number };
  resourceFlowStats: ResourceFlowStats;
}


export type ResourceFlow = { [resource: string]: number };

export class ResourceFlowStats {
  input: ResourceFlow;
  output: ResourceFlow;

  constructor() {
    this.input = {};
    this.output = {};
  }

  pushInput(resource: ResourceConstant, value: number) {
    if (!this.input[resource]) {
      this.input[resource] = value;
    } else {
      this.input[resource] += value;
    }
  }

  getInput(resource: ResourceConstant): number {
    if (this.input[resource]) {
      return this.input[resource];
    }
    return 0;
  }

  pushOutput(resource: ResourceConstant, value: number) {
    if (!this.output[resource]) {
      this.output[resource] = value;
    } else {
      this.output[resource] += value;
    }
  }

  getOutput(resource: ResourceConstant): number {
    if (this.output[resource]) {
      return this.output[resource];
    }
    return 0;
  }

  clear() {
    this.input = {};
    this.output = {};
  }
}