import { Commander } from "Commander";
import { HarvestDaemon, HaulerDaemon } from "daemons";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { deserializePos, serializePos } from "task/task-initializer";
import { log } from "utils/log";
import { findClosestByLimitedRange } from "utils/util-pos";



interface EnergySourceMemory {
  containerPos?: string;
  linkPos?: string;

  container?: Id<_HasId>;
  link?: Id<_HasId>;
  constructionSite?: Id<_HasId>;
}


export class EnergySourceDirective extends Directive {

  static Setting = {
    rclContainer: 3
  }

  memory: EnergySourceMemory;

  daemons: {
    harvest: HarvestDaemon,
    hauler: HaulerDaemon
  };

  containerPos: RoomPosition;
  linkPos: RoomPosition;

  private _containerCache: MemCacheObject<StructureContainer>;
  private _linkCache: MemCacheObject<StructureLink>;
  private _constructionSiteCache: MemCacheObject<ConstructionSite>;

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub, true);
    this.memory = Mem.wrap(flag.memory, 'energy_source', {});

    this._containerCache = new MemCacheObject(this.memory, 'container');
    this._linkCache = new MemCacheObject<StructureLink>(this.memory, 'link');
    this._constructionSiteCache = new MemCacheObject(this.memory, 'construction_site');

    let path = null;

    if (!this.memory.containerPos || !this.memory.containerPos) {
      path = this.pos.findPathTo(this.hub.pos, { ignoreCreeps: true });
    }

    if (!this.memory.containerPos && path) {
      const step = path[0];
      this.memory.containerPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    if (!this.memory.linkPos && path) {
      const stepIndex = Math.min(1, path.length);
      const step = path[stepIndex];
      this.memory.linkPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    this.containerPos = deserializePos(this.memory.containerPos!);
    this.linkPos = deserializePos(this.memory.linkPos!);
  }

  get container(): StructureContainer | null {
    return this._containerCache.value;
  }

  get link(): StructureLink | null {
    return this._linkCache.value;
  }

  spawnDaemons(): void {

    const source = _.find(this.hub.sources, source => source.pos.roomName == this.pos.roomName && source.pos.x == this.pos.x && source.pos.y == this.pos.y);

    if (source) {
      const priority = 50 - 1 / ((this.flag.memory as any)['hubDistance'] ?? 1);
      if (!this.daemons.harvest) {
        this.daemons.harvest = new HarvestDaemon(this.hub, this, source, priority);
      }
      if (!this.daemons.hauler && !this._linkCache.isValid()) {
        this.daemons.hauler = new HaulerDaemon(this.hub, this, priority);
      }
    } else {
      log.error(`${this.print} No source available`)
    }
  }

  private buildHandler() {

    if (this.pos.roomName != this.hub.room.name) {
      return;
    }

    if (this.hub.level < EnergySourceDirective.Setting.rclContainer) {
      return;
    }

    if (!this._containerCache.value && !this._constructionSiteCache.value) {
      // Create Container if required
      const r = this.containerPos.createConstructionSite(STRUCTURE_CONTAINER);
      if (r != OK) {
        log.warning(`${this.print} cannot create construction site ${r}`);
      }
    }

    if (!this._linkCache.value && !this._constructionSiteCache.value && this.hub.links.length >= 1) {
      // Create Link if required
      const r = this.linkPos.createConstructionSite(STRUCTURE_LINK);
      if (r != OK) {
        log.warning(`${this.print} cannot create construction site ${r}`);
      }
    }


  }

  refresh(): void {
    super.refresh();

    this.memory = Mem.wrap(this.flag.memory, 'energy_source', {});

    this._containerCache.refresh(this.memory);
    this._linkCache.refresh(this.memory);
    this._constructionSiteCache.refresh(this.memory);


    if (!Game.rooms[this.pos.roomName]) {
      // Room unreachable
      return;
    }

    if (!this._containerCache.value) {
      this._containerCache.value = findClosestByLimitedRange(this.pos, this.hub.containersByRooms[this.room.name] ?? [], 5);
    }

    if (!this._linkCache.isValid()) {
      this._linkCache.value = findClosestByLimitedRange(this.pos, this.hub.links, 5);
    }

    if (!this._constructionSiteCache.value) {
      this._constructionSiteCache.value = findClosestByLimitedRange(this.pos, this.hub.constructionSitesByRooms[this.room.name] ?? [], 5);
    }


  }

  init(): void {

    if (!Game.rooms[this.pos.roomName]) {
      // Room unreachable
      return;
    }

    if (this._linkCache.isValid() && this.daemons.hauler) {
      this.daemons.hauler.maxQuantity = 0;
    } else if (this.daemons.hauler) {
      this.daemons.hauler.maxQuantity = 1;
    }

    this.buildHandler();
  }

  run(): void {

  }

}