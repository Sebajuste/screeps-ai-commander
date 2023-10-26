import _, { Dictionary } from "lodash";
import { Mem } from "memory/Memory";
import { getRoomRange } from "utils/util-pos";



export interface ExploredRoom {
  tick: number;
  haveEnnemy: boolean;
  sourceCount: number;
  minerals: MineralConstant[];
  exits: string[];
  // bunkerSpace: boolean;
  controlledBy?: string;
  controllerPos?: RoomPosition;
  // bunkerAnchor?: RoomPosition;
}

export interface ExplorationMemory {
  lastUpdate: number;
  data: Dictionary<ExploredRoom>;
  invalidRooms: string[];
}

const EXPLORATION_DEFAULT_MEMORY = { lastUpdate: Game.time, data: {}, invalidRooms: [] };

export class Exploration {

  static settings = {
    roomTTL: 1000
  };

  private _memory?: ExplorationMemory;

  private static instance?: Exploration;

  private constructor() {

  }

  static exploration() {
    if (!Exploration.instance) {
      Exploration.instance = new Exploration();
    }
    return Exploration.instance;
  }

  private updateRoom(roomName: string, info: any) {
    this.memory.data[roomName] = _.defaults(info, this.memory.data[roomName] ?? {});
    this.memory.lastUpdate = Game.time;
  }

  private get memory(): ExplorationMemory {
    if (!this._memory) {
      this._memory = Mem.wrap(Memory, 'exploration', EXPLORATION_DEFAULT_MEMORY);
    }
    return this._memory as ExplorationMemory;
  }

  addInvalidRoom(room: string) {
    if (!this.memory.invalidRooms.includes(room)) {
      this.memory.invalidRooms.push(room);
    }
  }

  isInvalid(room: string) {
    return this.memory.invalidRooms.includes(room);
  }

  getRooms(): Dictionary<ExploredRoom> {
    return this.memory.data;
  }

  isEmpty(): boolean {
    return Object.keys(this.memory.data).length == 0;
  }

  hasRoom(roomName: string): boolean {
    return this.memory.data[roomName] != undefined;
  }

  getRoom(roomName: string): ExploredRoom | undefined {
    return this.memory.data[roomName];
  }

  getNearRooms(roomName: string, distance: number): string[] {

    if (this.memory.data[roomName] == undefined) {
      return [];
    }

    const nextSearch: string[] = [roomName];

    const result: string[] = [];


    while (nextSearch.length > 0) {
      const currentSearch = this.memory.data[nextSearch.shift() as string];

      currentSearch.exits.forEach(it => {
        if (getRoomRange(roomName, it) <= distance) {
          result.push(it);
          if (this.hasRoom(it) && !nextSearch.includes(it) && !result.includes(it)) {
            nextSearch.push(it)
          }

        }
      });

    }

    return _.uniq(result);
  }

  needUpdate(roomName: string): boolean {
    if (!this.hasRoom(roomName)) {
      return true;
    }
    return this.memory.data[roomName].tick + Exploration.settings.roomTTL < Game.time;
  }

  analyseRoom(room: Room) {

    if (this.hasRoom(room.name) && this.getRoom(room.name)?.tick != Game.time) {
      // Already updated
      return;
    }

    const haveEnnemy = (
      room.find(FIND_HOSTILE_STRUCTURES).length +
      room.find(FIND_HOSTILE_CONSTRUCTION_SITES).length +
      room.find(FIND_HOSTILE_POWER_CREEPS).length +
      room.find(FIND_HOSTILE_SPAWNS).length +
      room.find(FIND_HOSTILE_CREEPS).length
    ) > 0;
    const username = room.controller?.owner?.username;


    if (!this.hasRoom(room.name)) {
      // const anchor = RoomPlanner.determineLayoutPosition(bunkerLayout, roomName, 8);

      const sourceCount = Game.rooms[room.name].find(FIND_SOURCES).length;
      const minerals = _.map(Game.rooms[room.name].find(FIND_MINERALS), mineral => mineral.mineralType);
      const exists = _.values(Game.map.describeExits(room.name));
      const controllerPos = Game.rooms[room.name].controller?.pos;

      const info = {
        tick: Game.time,
        haveEnnemy: haveEnnemy,
        sourceCount: sourceCount,
        minerals: minerals,
        exits: exists,
        controlledBy: username,
        controllerPos: controllerPos
      } as ExploredRoom;
      this.updateRoom(room.name, info);

    } else {
      const info = {
        tick: Game.time,
        haveEnnemy: haveEnnemy,
        controlledBy: username,
      };
      this.updateRoom(room.name, info);
    }

  }

}