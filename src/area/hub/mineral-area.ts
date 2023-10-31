import { Area } from "area/Area";
import { MinerDaemon } from "daemons/resources/miner-daemon";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { deserializePos, serializePos } from "task/task-initializer";
import { log } from "utils/log";
import { findAtPos, findClosestByLimitedRange } from "utils/util-pos";

interface MinerMemory {
  containerPos?: string;
}

export class MineralArea extends Area {

  daemons: {
    miner: MinerDaemon
  }

  mineral: Mineral;

  memory: MinerMemory;

  containerPos: RoomPosition;

  private _containerCache: MemCacheObject<StructureContainer>;
  private _constructionSiteCache: MemCacheObject<ConstructionSite>;

  extractor?: StructureExtractor;

  constructor(hub: Hub, mineral: Mineral) {
    super(hub, mineral, `mineral_${mineral.mineralType.toLowerCase()}`, true);
    this.mineral = mineral;
    this.memory = Mem.wrap(this.hub.memory, `mineral_${mineral.mineralType.toLowerCase()}`);

    this._containerCache = new MemCacheObject(this.memory, 'container');
    this._constructionSiteCache = new MemCacheObject(this.memory, 'construction_site');

    let path = null;

    if (!this.memory.containerPos || !this.memory.containerPos) {
      path = this.pos.findPathTo(this.hub.pos, { ignoreCreeps: true });
    }

    if (!this.memory.containerPos && path) {
      const step = path[0];
      this.memory.containerPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    this.containerPos = deserializePos(this.memory.containerPos!);
  }

  get container(): StructureContainer | null {
    return this._containerCache.value;
  }

  private buildHandler() {

    if (!this._containerCache.value && !this._constructionSiteCache.value) {
      // Create Container if required
      const r = this.containerPos.createConstructionSite(STRUCTURE_CONTAINER);
      if (r != OK) {
        log.warning(`${this.print} cannot create construction site ${r}`);
      }
    }

  }

  spawnDaemons(): void {

    this.daemons.miner = new MinerDaemon(this.hub, this);

  }

  refresh(): void {

    this.extractor = findAtPos(this.pos, this.hub.structuresByRooms[this.pos.roomName] ?? []) as StructureExtractor | undefined;

    this._containerCache.refresh(this.memory);
    this._constructionSiteCache.refresh(this.memory);

    if (!this._containerCache.value) {
      this._containerCache.value = _.first(this.containerPos.lookFor(LOOK_STRUCTURES)) as StructureContainer ?? null; // findClosestByLimitedRange(this.pos, [this.containerPos], 1);
    }

    if (!this._containerCache.value) {
      this._constructionSiteCache.value = _.first(this.containerPos.lookFor(LOOK_CONSTRUCTION_SITES)) as ConstructionSite ?? null; // findClosestByLimitedRange(this.pos, [this.containerPos], 1);
    }

  }

  init(): void {

    this.buildHandler();

  }

  run(): void {

  }



}