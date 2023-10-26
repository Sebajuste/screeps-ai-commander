import _ from "lodash";
import { Coord, isEqualRoomPosition } from "utils/coord";
import { RoomPlanner } from "./room-planner";
import { Hub } from "hub/Hub";
import { Mem } from "memory/Memory";
import { getMultiRoomRange } from "utils/util-pos";
import { log } from "utils/log";
import { Visualizer } from "ui/visualizer";

const ROAD_COST = 1;
const SWAMP_COST = 4;
const PLAIN_COST = 3;
const WALL_COST = 45;
const OBSTACLE_COST = 255;

export interface RoadPlannerMemory {
  // roadLookup: { [roomName: string]: { [roadCoordName: string]: boolean } };
  roadLookup: { [roomName: string]: Coord[] };
  roadCoverage: number;
  roadCoverages: {
    [destination: string]: {
      roadCount: number;
      length: number;
      exp: number;
    }
  };
}

const MEMORY_DEFAULT = {
  roadLookup: {},
  roadCoverage: 0.0,
  roadCoverages: {}
}

export class RoadPlanner {

  roomPlanner: RoomPlanner;
  hub: Hub;
  memory: RoadPlannerMemory;
  roadPositions: RoomPosition[];
  costMatrices: { [roomName: string]: CostMatrix };

  static settings = {
    encourageRoadMerging: true,
    recalculateRoadNetworkInterval: 1000,   // recalculate road networks this often  onPublicServer() ? 3000 : 1000
    recomputeCoverageInterval: 500,	        // recompute coverage to each destination this often  onPublicServer() ? 1000 : 500
    buildRoadsAtRCL: 2,
    buildRoadsInterval: 100
  };


  constructor(roomPlanner: RoomPlanner) {
    this.roomPlanner = roomPlanner;
    this.hub = roomPlanner.hub;
    this.memory = Mem.wrap(this.hub.memory, 'roadPlanner', MEMORY_DEFAULT);
    this.costMatrices = {};
    this.roadPositions = [];
  }

  get roadCoverage(): number {
    return this.memory.roadCoverage;
  }

  private generateRoadPlanningCostMatrix(roomName: string, obstacles: RoomPosition[], lowCostPosition: RoomPosition[]) {

    const matrix = new PathFinder.CostMatrix();
    const terrain = Game.map.getRoomTerrain(roomName);


    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        switch (terrain.get(x, y)) {
          case TERRAIN_MASK_SWAMP:
            matrix.set(x, y, SWAMP_COST);
            break;
          case TERRAIN_MASK_WALL:
            if (x != 0 && y != 0 && x != 49 && y != 49) {
              // Can't tunnel through walls on edge tiles
              matrix.set(x, y, WALL_COST);
            }
            break;
          default: // plain
            matrix.set(x, y, PLAIN_COST);
            break;
        }
      }
    }

    _.forEach(_.filter(obstacles, pos => pos.roomName == roomName), pos => matrix.set(pos.x, pos.y, OBSTACLE_COST));

    _.forEach(_.filter(lowCostPosition, pos => pos.roomName == roomName), pos => matrix.set(pos.x, pos.y, ROAD_COST));

    return matrix;
  }

  private generateRoadsPath(origin: RoomPosition, destination: RoomPosition, obstacles: RoomPosition[], lowCostPositions: RoomPosition[]): RoomPosition[] {

    const callback = (roomName: string): CostMatrix | boolean => {

      /*
      if (!this.colony.rooms.find(r => r.name == roomName)) { // only route through colony rooms
          return false;
      }
      */

      // if (Pathing.shouldAvoid(roomName) && roomName != origin.roomName && roomName != destination.roomName) {
      /*
  if (roomName != origin.roomName && roomName != destination.roomName) {
      return false;
  }
  */
      if (!this.costMatrices[roomName]) {
        this.costMatrices[roomName] = this.generateRoadPlanningCostMatrix(roomName, obstacles, lowCostPositions);
      }
      return this.costMatrices[roomName];
    };

    const pathFinder = PathFinder.search(origin, { pos: destination, range: 1 }, { roomCallback: callback, maxOps: 40000 });

    return pathFinder.path;
  }

  private buildRoadNetwork(origin: RoomPosition = this.roomPlanner.hub.pos, obstacles: RoomPosition[] = this.roomPlanner.getObstacles()) {

    const destinations: Structure[] = _.compact(_.concat(this.roomPlanner.hub.containers as Structure[], this.roomPlanner.hub.controller as Structure));

    const roadPositions = _.map(_.filter(this.roomPlanner.hub.structures, structure => structure.structureType == STRUCTURE_ROAD), road => road.pos);
    const constructonRoadPositions = _.map(_.filter(this.roomPlanner.hub.constructionSites, structure => structure.structureType == STRUCTURE_ROAD), road => road.pos);
    // const roadPlannedPosition = _.map(this.memory.roadLookup[roomName], coord => new RoomPosition(coord.x, coord.y, roomName));

    const lowCostPositions = _.concat(roadPositions, constructonRoadPositions);

    this.roadPositions = _.uniqWith(_.flatten(_.map(destinations, destination => this.generateRoadsPath(origin, destination.pos, obstacles, lowCostPositions))), isEqualRoomPosition);

  }

  private buildMissing(): void {

    // Max buildings that can be placed each tick
    let count = RoomPlanner.settings.maxSitesPerColony - this.hub.constructionSites.length;

    let roadPositions: RoomPosition[] = [];
    for (const roomName in this.memory.roadLookup) {
      const positions = _.map(this.memory.roadLookup[roomName], coord => new RoomPosition(coord.x, coord.y, roomName));
      roadPositions = _.concat(roadPositions, positions);
    }
    const origin = (this.hub.storage || this.hub.areas.agentFactory || this.hub).pos;

    const roads = _.chain(roadPositions)//
      .sortBy(pos => getMultiRoomRange(pos, origin))//
      .filter(pos => RoomPlanner.canBuild(STRUCTURE_ROAD, pos))//
      .take(count)//
      .value();

    _.forEach(roads, pos => pos.createConstructionSite(STRUCTURE_ROAD));

  }

  refresh(): void {
    this.memory = Mem.wrap(this.hub.memory, 'roadPlanner', MEMORY_DEFAULT);
    this.costMatrices = {};
    this.roadPositions = [];
  }

  init(): void {
    // Empty

    this.costMatrices = {};

  }

  finalize() {

    // Collect all roads from this and from room planner
    let roomPlannerRoads: RoomPosition[];
    if (_.keys(this.roomPlanner.map).length > 0) { // use active map
      roomPlannerRoads = this.roomPlanner.map[STRUCTURE_ROAD];
    } else { // retrieve from memory
      const layout = this.roomPlanner.getStructureMapForBunkerAt();
      if (layout) {
        roomPlannerRoads = layout[STRUCTURE_ROAD];
      } else if (this.roomPlanner.memory.mapsByLevel) {
        const layout = _.mapValues(this.roomPlanner.memory.mapsByLevel[8]);
        roomPlannerRoads = layout[STRUCTURE_ROAD];
      } else {
        log.error(`RoadPlanner@${this.hub.room.name}: could not get road positions from room planner!`);
        roomPlannerRoads = [];
      }
    }
    const allRoadPos: RoomPosition[] = _.uniqWith(_.compact(this.roadPositions.concat(roomPlannerRoads)), isEqualRoomPosition);

    // Encode the coordinates of the road as keys in a truthy hash table for fast lookup
    this.memory.roadLookup = {};
    for (const pos of allRoadPos) {
      if (!this.memory.roadLookup[pos.roomName]) {
        this.memory.roadLookup[pos.roomName] = [];
      }
      // this.memory.roadLookup[pos.roomName][`${pos.x}:${pos.y}`] = true;
      this.memory.roadLookup[pos.roomName].push({ x: pos.x, y: pos.y });
    }

  }

  run(): void {


    if (this.roomPlanner.active) {
      if (this.roomPlanner.storagePos) {
        this.buildRoadNetwork(this.roomPlanner.storagePos, this.roomPlanner.getObstacles());
        this.visuals()
      } else {
        log.warning(`${this.hub.print} Road planner - No storage pos`)
      }
    } else {
      // Recalculate periodicaly the entire network and write to memory to keep it up to date
      if (Game.time % RoadPlanner.settings.recalculateRoadNetworkInterval == this.hub.id) {
        if (this.roomPlanner.storagePos) {
          // this.recalculateRoadNetwork(this.roomPlanner.storagePos, this.roomPlanner.getObstacles());
          this.buildRoadNetwork(this.roomPlanner.storagePos, this.roomPlanner.getObstacles());
          this.finalize();
        } else {
          const spawn = this.hub.spawns[0];
          if (spawn) {
            this.buildRoadNetwork(spawn.pos, this.roomPlanner.getObstacles());
            this.finalize();
          }
        }
      }
      /*
      // Recompute coverage to destinations
      if (Game.time % getAllColonies().length == this.colony.id && this.roomPlanner.storagePos) {
          // this.recomputeRoadCoverages(this.roomPlanner.storagePos);
          this.buildRoadNetwork(this.roomPlanner.storagePos, this.roomPlanner.getObstacles());
          this.finalize();
      }
      */
      // Build missing roads
      // if (this.colony.level >= RoadPlanner.settings.buildRoadsAtRCL && this.roomPlanner.shouldRecheck(3)) {
      if (this.hub.level >= RoadPlanner.settings.buildRoadsAtRCL && Game.time % RoadPlanner.settings.buildRoadsInterval == this.hub.id) {
        this.buildMissing();
      }
    }


    /*
    if( Game.time % 37 == 0 && this.roomPlanner.colony.controller.level > 1) {
        this.determine_roads();
    }
    if( Game.time % 100 == 0) {
        this.generate_roads();
    }
    */

  }

  visuals(): void {

    /*
    const vis = new RoomVisual(this.colony.name);

    const road_positions = _.map(this.colony.rooms, room => {
        return _.map(this.memory.roadLookup[room.name], pos_serialized => {
            const [x, y] = pos_serialized.split(':');
            return new RoomPosition(parseInt(x), parseInt(y), room.name);
        });
    } );

    _.forEach( _.flatten( road_positions ), (pos => {
        vis.rect(pos, 1, 1, {fill: '#ff0000'});
    }) );
    */

    Visualizer.drawRoads(this.roadPositions);

  }

}