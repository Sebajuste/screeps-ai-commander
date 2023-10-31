import { Actor } from "Actor";
import { Daemon } from "daemons/daemon";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";

export abstract class Area implements Actor {
  name: string;
  ref: string;
  hub: Hub;
  room: Room;
  pos: RoomPosition;
  memory: any;

  daemons: { [name: string]: Daemon };

  performanceReport: { [stat: string]: number };

  constructor(hub: Hub, instantiationObject: RoomObject, name: string, includePos = false) {
    this.name = name;
    this.ref = includePos ? name + '@' + instantiationObject.pos.roomName : name + '@' + hub.name;
    this.hub = hub;
    this.room = instantiationObject.room!;
    this.pos = instantiationObject.pos;
    this.daemons = {};

    this.performanceReport = {};
  }

  get print(): string {
    return `<a href="#!/room/${Game.shard.name}/${this.pos.roomName}">[${this.name}@${this.room.name}]</a>`;
  }

  abstract spawnDaemons(): void;

  registerDaemons() {
    this.spawnDaemons();
    _.values(this.daemons).forEach(daemon => this.hub.dispatcher.registerDaemon(daemon));
  }

  refresh() {

  }

  abstract init(): void;

  abstract run(): void;

}