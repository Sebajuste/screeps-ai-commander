import { Hub } from "hub/Hub";
import { Mem } from "memory/Memory";
import { PlannerMemory, RoomPlan, RoomPlanner, StructureLayout, StructureMap, lookForStructure } from "./room-planner";
import { log } from "utils/log";
import { Coord } from "utils/coord";
import _ from "lodash";
import { BuildPriorities } from "./room-priorities-structures";
import { bunkerLayout } from "./bunker-layout";
import { printPos } from "utils/util-pos";





export interface BunkerPlannerMemory extends PlannerMemory {

  relocating?: boolean;
  /*
  bunkerData?: {
    anchor: RoomPosition,
  };
  */
  anchor?: RoomPosition;
  //mining_site: string[],
  lastGenerated?: number;

  // savedFlags: { secondaryColor: ColorConstant, pos: RoomPosition, memory: FlagMemory }[];
  //storage: RoomPosition | undefined;
}

const MEMORY_DEFAULT: BunkerPlannerMemory = {
  active: true,
  // savedFlags: [],
  //mining_site: [],
  //storage: undefined
};

export class BunkerRoomPlanner extends RoomPlanner {

  memory: BunkerPlannerMemory;

  bunker?: RoomPosition;

  plan?: RoomPlan;

  constructor(hub: Hub) {
    super(hub, MEMORY_DEFAULT);
  }

  /**
   * Return the planned location of the storage structure
   */
  get storagePos(): RoomPosition | undefined {
    const positions = this.plannedStructurePositions(STRUCTURE_STORAGE);
    if (positions) {
      return positions[0];
    }
  }

  private updateLayoutPosition(layout: any, roomName: string) {

  }

  private generatePlan(level = 8): RoomPlan | undefined {
    // const plan: RoomPlan = {};
    const layout: StructureLayout = bunkerLayout;
    const anchor: Coord = layout.data.anchor;
    // const pos = this.placements[<'factory' | 'commandCenter' | 'bunker'>name];
    if (!this.bunker) {
      log.warning(`${this.hub.print} No layout valid location`);
      return;
    }
    // let rotation: number = pos!.lookFor(LOOK_FLAGS)[0]!.memory.rotation || 0;
    const componentMap = RoomPlanner.parseLayout(layout, this.hub.name, level);
    RoomPlanner.translateComponent(componentMap, anchor, this.bunker!);
    // if (rotation != 0) this.rotateComponent(componentMap, pos!, rotation);
    return {
      map: componentMap,
      pos: new RoomPosition(anchor.x, anchor.y, this.hub.name),
      rotation: 0,
    } as RoomPlan;
  }


  private make(level = 8) {
    // Reset everything
    this.map = {};
    // Generate a plan, placing components by flags
    this.plan = this.generatePlan(level);
    // Flatten it into a map
    this.map = this.plan?.map!;
  }

  public getStructureMapForBunkerAt(level = 8): StructureMap {
    const anchor = this.memory.anchor!;
    const dx = anchor.x - bunkerLayout.data.anchor.x;
    const dy = anchor.y - bunkerLayout.data.anchor.y;
    const structureLayout = bunkerLayout[level]!.structures;
    return _.mapValues(structureLayout, coordArr => _.map(coordArr, coord => new RoomPosition(coord.x + dx, coord.y + dy, this.hub.name)));
  }

  private recallMap(level = this.hub.controller.level): void {
    if (this.memory.anchor) {
      this.map = this.getStructureMapForBunkerAt(level);
    } else if (this.memory.mapsByLevel) {
      // this.map = _.mapValues(this.memory.mapsByLevel[level], posArr => _.map(posArr, protoPos => derefRoomPosition(protoPos)));
      this.map = _.mapValues(this.memory.mapsByLevel[level]);
    }
  }

  private buildMissingStructures() {
    // Max buildings that can be placed each tick
    let count = RoomPlanner.settings.maxSitesPerColony - this.hub.constructionSites.length;

    log.debug(`build ${count} MissingStructures`)

    // Recall the appropriate map
    this.recallMap();
    if (!this.map || Object.keys(this.map).length === 0) { // in case a map hasn't been generated yet
      log.info(this.hub.name + ' does not have a room plan yet! Unable to build missing structures.');
    }
    // Build missing structures from room plan
    for (const structureType of BuildPriorities) {
      if (this.map[structureType]) {
        for (const pos of this.map[structureType]) {
          if (count > 0 && RoomPlanner.canBuild(structureType, pos)) {
            const result = pos.createConstructionSite(structureType);
            if (result != OK) {
              const structures = pos.lookFor(LOOK_STRUCTURES);
              for (const structure of structures) {
                const safeTypes: string[] = [STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_SPAWN];
                // Destroy the structure if it is less important and not protected
                if (!this.structureShouldBeHere(structure.structureType, pos) && !safeTypes.includes(structure.structureType)) {
                  const result = structure.destroy();
                  log.info(`${this.hub.name}: destroyed ${structure.structureType} at ${structure.pos}`);
                  if (result == OK) {
                    this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
                  }
                }
              }
              log.warning(`${this.hub.name}: couldn't create construction site of type "${structureType}" at ${pos}. Result: ${result}`);
            } else {
              count--;
              this.memory.recheckStructuresAt = Game.time + RoomPlanner.settings.recheckAfter;
            }
          }
        }
      }
    }


    // Build extractor on mineral deposit if not already present
    const mineral = this.hub.room.find(FIND_MINERALS)[0];
    if (mineral && this.hub.controller.level >= 6) {
      const extractor = lookForStructure(mineral.pos, STRUCTURE_EXTRACTOR);
      const extractorBuild = mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES); //  lookForStructure(mineral.pos, LOOK_CONSTRUCTION_SITES);
      // if ((!extractor || extractor.length == 0) && (!extractorBuild || extractorBuild.length == 0)) {
      if (extractor.length == 0 && extractorBuild.length == 0) {
        const r = mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
        if (r != OK) {
          log.warning('Cannot create Exctrator at ', JSON.stringify(mineral.pos), ' ', r);
        }
      }
    }
  }

  private finalize(ignoreRoads = false) {
    const collision = RoomPlanner.findCollision(ignoreRoads, this.map, this.hub.room.name);
    if (collision) {
      log.warning(`Invalid layout: collision detected at ${printPos(collision)}!`);
      return;
    }
    const layoutIsValid: boolean = !!this.bunker;
    if (layoutIsValid) { // Write everything to memory
      // Generate maps for each rcl
      delete this.memory.anchor;
      delete this.memory.mapsByLevel;
      if (this.bunker) {
        this.memory.anchor = this.bunker;
      } else {
        this.memory.mapsByLevel = {};
        for (let rcl = 1; rcl <= 8; rcl++) {
          this.make(rcl);
          this.memory.mapsByLevel[rcl] = this.map;
        }
      }
      // Finalize the barrier planner
      // this.barrierPlanner.finalize();

      // Finalize the road planner
      this.roadPlanner.finalize();

      // Save flags and remove them
      /*
      const flagsToWrite = _.filter(this.hub.flags, flag => flag.color == COLOR_WHITE);
      for (const flag of flagsToWrite) {
        this.memory.savedFlags.push({
          secondaryColor: flag.secondaryColor,
          pos: flag.pos,
          memory: flag.memory,
        });
        flag.remove();
      }
      */
      this.memory.lastGenerated = Game.time;
      console.log('Room layout and flag positions have been saved.');
      // Destroy needed buildings
      if (this.hub.level == 1) { // clear out room if setting in for first time
        // this.demolishMisplacedStructures(true, true);
        // Demolish all barriers that aren't yours
        /*
        for (const barrier of this.hub.room.barriers) {
          if (barrier.structureType == STRUCTURE_WALL || !barrier.my) {
            barrier.destroy();
          }
        }
        */

      }
      this.memory.recheckStructuresAt = Game.time + 3;
      this.active = false;
    } else {
      log.warning('Not a valid room layout! Must have both factory and commandCenter placements or bunker placement.');
    }
  }

  structureShouldBeHere(structureType: StructureConstant, pos: RoomPosition, level: number = this.hub.controller.level): boolean {
    if (structureType == STRUCTURE_ROAD) {
      // return this.roadShouldBeHere(pos);
      return false;
    } else if (structureType == STRUCTURE_RAMPART) {
      // return this.barrierPlanner.barrierShouldBeHere(pos);
      return false;
    } else if (structureType == STRUCTURE_EXTRACTOR) {
      return pos.lookFor(LOOK_MINERALS).length > 0;
    } else {
      if (_.isEmpty(this.map)) {
        this.recallMap(level);
      }
      const positions = this.map[structureType];
      if (positions && _.find(positions, p => p.isEqualTo(pos))) {
        return true;
      }
      /*
      if (structureType == STRUCTURE_CONTAINER || structureType == STRUCTURE_LINK) {
        const thingsBuildingLinksAndContainers = _.map([...this.colony.room.sources,
                            this.colony.room.mineral!,
                            this.colony.controller], thing => thing.pos);
        const maxRange = 4;
        return pos.findInRange(thingsBuildingLinksAndContainers, 4).length > 0;
      }
      */
    }
    return false;
  }

  getObstacles(): RoomPosition[] {

    if (!this.map) {
      this.recallMap(8);
    }

    let obstacles: RoomPosition[] = [];
    const passableStructureTypes: string[] = [STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART];
    if (_.keys(this.map).length > 0) { // if room planner has made the map, use that
      for (const structureType in this.map) {
        if (!passableStructureTypes.includes(structureType)) {
          obstacles = obstacles.concat(this.map[structureType]);
        }
      }
    } else { // else, serialize from memory
      if (this.memory.anchor) {
        const structureMap = this.getStructureMapForBunkerAt();
        for (const structureType in structureMap) {
          if (!passableStructureTypes.includes(structureType)) {
            obstacles = obstacles.concat(structureMap[structureType]);
          }
        }
      } else if (this.memory.mapsByLevel) {
        for (const structureType in this.memory.mapsByLevel[8]) {
          if (!passableStructureTypes.includes(structureType)) {
            // obstacles = obstacles.concat(_.map(this.memory.mapsByLevel[8][structureType], protoPos => derefRoomPosition(protoPos)));
            obstacles = obstacles.concat(this.memory.mapsByLevel[8][structureType]);
          }
        }
      }
    }
    return _.uniq(obstacles);
  }

  /**
     * Get the placement for a single type of structure for bunker layout
     */
  getBunkerStructurePlacement(structureType: string, anchor: { x: number, y: number }, level = 8): RoomPosition[] {
    const dx = anchor.x - bunkerLayout.data.anchor.x;
    const dy = anchor.y - bunkerLayout.data.anchor.y;
    return _.map(bunkerLayout[level]!.structures[structureType], coord => new RoomPosition(coord.x + dx, coord.y + dy, this.hub.name));
  }

  /**
   * Return a list of room positions for planned structure locations at RCL8 (or undefined if plan isn't made yet)
   */
  plannedStructurePositions(structureType: StructureConstant): RoomPosition[] | undefined {
    if (this.map[structureType]) {
      return this.map[structureType];
    }
    if (this.memory.anchor) {
      return this.getBunkerStructurePlacement(structureType, this.memory.anchor);
    }
    const roomMap = this.memory.mapsByLevel ? this.memory.mapsByLevel[8] : undefined;
    if (roomMap && roomMap[structureType]) {
      // return _.map(roomMap[structureType], protoPos => derefRoomPosition(protoPos));
      return roomMap[structureType];
    }
  }



  init() {
    if (this.active) {

      if (!this.bunker) {
        const spawn = this.hub.spawns[0];
        if (spawn) {
          const spawnPos = spawn.pos;
          const bunkerAnchor = new RoomPosition(spawnPos.x - 4, spawnPos.y, spawnPos.roomName);
          this.bunker = bunkerAnchor;
        } else {
          log.error(`${this.hub.print} No spawn detected`)
        }
      }
    }
    this.roadPlanner.init();
  }

  refresh() {
    super.refresh();
    this.memory = Mem.wrap(this.hub.memory, 'roomPlanner', MEMORY_DEFAULT);
    this.bunker = this.memory.anchor;
    this.plan = undefined;
    this.map = {};
    this.roadPlanner.refresh();
    if (this.active && Game.time % 25 == 0) {
      log.alert(`RoomPlanner for ${this.hub.print} is still active! Close to save CPU.`);
    }
  }

  run(): void {

    log.debug('RoomPlanner run ', this.active);

    if (this.active) {
      this.make();
      this.visuals();
    } else {
      if (this.shouldRecheck()) {
        this.buildMissingStructures();
      }
    }

    this.roadPlanner.run();

    if (this.active) {
      if (this.bunker) {
        this.finalize();
      } else {
        log.warning(`${this.hub.print} No bunker placement!`);
        this.updateLayoutPosition(bunkerLayout, this.hub.room.name);
      }
    }

  }



}