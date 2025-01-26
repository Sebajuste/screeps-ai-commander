import { ObserverDaemon } from "daemons/expend/observer-daemon";
import _, { Dictionary } from "lodash";
import { Mem } from "memory/Memory";
import { DistanceTransform } from "utils/distance-transform";
import { log } from "utils/log";
import { getRoomRange } from "utils/util-pos";


export interface MineralInfo {
  type: MineralConstant,
  density: number
}

export interface ExploredRoom {
  tick: number;
  haveEnnemy: boolean;
  sourceCount: number;
  minerals: MineralInfo[];
  exits: string[];
  // bunkerSpace: boolean;
  controlledBy?: string;
  controllerPos?: RoomPosition;
  // bunkerAnchor?: RoomPosition;
  maxWallDistance: number;
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

  private _explorationList: string[] = [];

  private _invalidRooms: string[] = [];

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

  /**
   * Check if a room needs to be updated based on its last update time and the room TTL.
   * @param {string} roomName - The name of the room to check for updates.
   * @returns {boolean} True if the room needs an update, false otherwise.
   */
  needUpdate(roomName: string): boolean {
    if (!this.hasRoom(roomName)) {
      return true;
    }
    return this.memory.data[roomName].tick + Exploration.settings.roomTTL < Game.time;
  }

  analyseRoom(room: Room) {

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

      const sourceCount = room.find(FIND_SOURCES).length;
      const minerals = _.map(room.find(FIND_MINERALS), mineral => ({ type: mineral.mineralType, density: mineral.density } as MineralInfo));
      const exists = _.values(Game.map.describeExits(room.name));
      const controllerPos = room.controller?.pos;

      const distanceTransformMap = DistanceTransform.computeWallDistance(room.name);
      const maxWallDistance = DistanceTransform.maxDistance(distanceTransformMap);

      const info = {
        tick: Game.time,
        haveEnnemy: haveEnnemy,
        sourceCount: sourceCount,
        minerals: minerals,
        exits: exists,
        controlledBy: username,
        controllerPos: controllerPos,
        maxWallDistance: maxWallDistance
      } as ExploredRoom;
      this.updateRoom(room.name, info);

    } else {

      const distanceTransformMap = DistanceTransform.computeWallDistance(room.name);
      const maxWallDistance = DistanceTransform.maxDistance(distanceTransformMap);

      const info = {
        tick: Game.time,
        haveEnnemy: haveEnnemy,
        controlledBy: username,
        maxWallDistance: maxWallDistance
      };
      this.updateRoom(room.name, info);
    }

  }

  observerRoom(observer: StructureObserver, targetRoom: string): ScreepsReturnCode {

    const room = Game.rooms[targetRoom];
    if (room) {
      // If 1 room is visible, analyse it and reset target room
      this.analyseRoom(room);
      // this.targetRoom = undefined;
      return OK;
    } else {
      // If 1 room is not visible, check if observer can observe it

      const result = observer.observeRoom(targetRoom);
      if (result != OK) {
        // log.error(`${this.print} Cannot observeRoom ${this.targetRoom}`);
        // this.invalidRooms.push(this.targetRoom)
        this._invalidRooms.push(targetRoom);
        //this.targetRoom = undefined;
      }
      return result;
    }

  }


  nextRoom() {

    if (this._explorationList.length == 0) {

      this._explorationList = _.chain(Object.keys(this.getRooms()))//
        .filter(roomName => this.needUpdate(roomName) && !this._invalidRooms.includes(roomName))//
        .orderBy(roomInfo => this.getRoom(roomInfo)?.tick, ['asc'])//
        .value();

    }

    return this._explorationList.pop();

    /*
    const targetRoom = _.chain(Object.keys(exploration.getRooms()))//
      .filter(roomName => exploration.needUpdate(roomName) && !this.invalidRooms.includes(roomName))//
      .orderBy(roomInfo => exploration.getRoom(roomInfo)?.tick, ['desc'])//
      .first()//
      .value();
    */
  }

}