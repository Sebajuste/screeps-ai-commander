import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { Coord } from "utils/coord";
import { log } from "utils/log";
import { RoadPlanner } from "./road-planner";
import { Visualizer } from "ui/visualizer";

export type StructureMap = { [structureType: string]: RoomPosition[] };

export interface BuildingPlannerOutput {
  name?: string;
  shard?: string;
  rcl: number;
  structures: { [structureType: string]: Coord[] };
}

export interface StructureLayout {
  [rcl: number]: BuildingPlannerOutput | undefined;

  data: {
    anchor: Coord;
    pointsOfInterest?: {
      [pointLabel: string]: Coord;
    }
  };
}


export interface RoomPlan {
  map: StructureMap;
  pos: Coord;
  rotation: number;
}

export interface PlannerMemory {
  active: boolean;
  recheckStructuresAt?: number;
  mapsByLevel?: { [rcl: number]: { [structureType: string]: RoomPosition[] } };
}

export abstract class RoomPlanner {

  static settings = {
    recheckAfter: 50,
    siteCheckFrequency: 100,	// how often to recheck for structures; doubled at RCL8 ? 300 : 100
    linkCheckFrequency: 100,
    maxSitesPerColony: 10, // Maximum of construction site as same time ? 10 : 25
    maxDismantleCount: 5,
  };

  hub: Hub;

  map: StructureMap;

  memory: PlannerMemory;

  roadPlanner: RoadPlanner;

  dismantleList: Structure[];

  constructor(hub: Hub, memoryDefault: PlannerMemory) {
    this.hub = hub;
    this.memory = Mem.wrap(this.hub.memory, 'roomPlanner', memoryDefault);
    this.roadPlanner = new RoadPlanner(this);
    this.dismantleList = [];
  }

  get active(): boolean {
    return this.memory.active;
  }

  set active(value: boolean) {
    this.memory.active = value;
  }

  abstract get storagePos(): RoomPosition | undefined;

  protected shouldRecheck(offset = 0): boolean {
    log.debug(`> Game.time: ${Game.time} >= ${this.memory.recheckStructuresAt}`)
    if (Game.time >= (this.memory.recheckStructuresAt || Infinity) + offset) {
      this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
      return true;
    } else if (this.hub.level == 8) {
      return Game.time % (2 * RoomPlanner.settings.siteCheckFrequency) == 2 * this.hub.id + offset;
    } else {
      return Game.time % RoomPlanner.settings.siteCheckFrequency == 2 * this.hub.id + offset;
    }
  }

  getObstacles(): RoomPosition[] {
    return [];
  }

  getStructureMapForBunkerAt(level = 8): StructureMap | undefined {
    return;
  }

  addDismantle(structure: Structure) {
    this.dismantleList.push(structure);
  }

  isDismantle(structure: Structure) {
    return this.dismantleList.find(it => it.id == structure.id) != undefined;
  }

  abstract init(): void;

  refresh(): void {
    this.dismantleList = [];
  }

  abstract run(): void;

  visuals() {

    Visualizer.drawStructureMap(this.map);

  }

  static parseLayout(structureLayout: StructureLayout, colonyName: string, level = 8): StructureMap {
    const map = {} as StructureMap;
    const layout = structureLayout[level];
    if (layout) {
      for (const buildingName in layout.structures) {
        map[buildingName] = _.map(layout.structures[buildingName], pos => new RoomPosition(pos.x, pos.y, colonyName));
      }
    }
    return map;
  }

  static translateComponent(map: StructureMap, fromPos: RoomPosition | Coord, toPos: RoomPosition | Coord): void {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    for (const structureType in map) {
      for (const pos of map[structureType]) {
        pos.x += dx;
        pos.y += dy;
      }
    }
  }

  static canBuild(structureType: BuildableStructureConstant, pos: RoomPosition): boolean {
    // if (!pos.room) return false;
    const buildings = _.filter(pos.lookFor(LOOK_STRUCTURES), s => s && s.structureType == structureType);
    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (!buildings || buildings.length == 0) {
      if (!sites || sites.length == 0) {
        return true;
      }
    }
    return false;
  }

  protected static findCollision(ignoreRoads = false, map: StructureMap, colonyName: string): RoomPosition | undefined {
    const terrain = Game.map.getRoomTerrain(colonyName);
    for (const structureType in map) {
      if (ignoreRoads && structureType == STRUCTURE_ROAD) {
        continue;
      }
      for (const pos of map[structureType]) {
        if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) {
          return pos;
        }
      }
    }
  }


}

export function lookForStructure(pos: RoomPosition, structureType: string): Structure[] {

  return pos.lookFor(LOOK_STRUCTURES).filter(structure => structure.structureType == structureType);

}