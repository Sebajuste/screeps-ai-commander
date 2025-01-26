
import { AgentFactoryArea, ProtoCreep, SpawnRequest } from "./agent-factory";
import { Hub } from "hub/Hub";
import { Daemon } from "daemons";
import { AgentSetup } from "agent/Agent";


export class AgentFactoryRemoteArea extends AgentFactoryArea {

  private _source: AgentFactoryArea;

  constructor(hub: Hub, source: AgentFactoryArea) {
    super(hub, hub.controller, 'agent_factory_remote_area');
    this._source = source;
  }

  get nextAvailability(): number {
    return this._source.nextAvailability;
  }

  get spawning() {
    return this._source.spawning;
  }

  isLocal() {
    return false;
  }

  energyAvailable() {
    return this._source.hub.room.energyAvailable;
  }

  generateProtoCreep(setup: AgentSetup, daemon: Daemon, memory?: any): ProtoCreep {
    return this._source.generateProtoCreep(setup, daemon, memory);
  }

  canSpawn(body: BodyPartConstant[]): boolean {
    return this._source.canSpawn(body);
  }

  enqueue(request: SpawnRequest): void {
    this._source.enqueue(request);
  }

}