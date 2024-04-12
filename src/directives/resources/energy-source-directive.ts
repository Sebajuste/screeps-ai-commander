import { Commander } from "Commander";
import { HarvestDaemon, HaulerDaemon } from "daemons";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { deserializePos, serializePos } from "task/task-initializer";
import { Coord, coordFromName, findNearValidPos, isEqualCoord } from "utils/coord";
import { log } from "utils/log";
import { linksSourceMax } from "utils/rcl-tool";
import { findClosestByLimitedRange } from "utils/util-pos";



interface EnergySourceMemory {
  containerPos?: string;
  linkPos?: string;

  // container?: Id<_HasId>;
  // link?: Id<_HasId>;
  // constructionSite?: Id<_HasId>;
}




export class EnergySourceDirective extends Directive {

  static Setting = {
    rclContainer: 3
  }

  memory: EnergySourceMemory;

  daemons: {
    harvest: HarvestDaemon,
  };

  containerPos: RoomPosition;
  linkPos: RoomPosition;

  isOutpost: boolean;

  private _containerCache: MemCacheObject<StructureContainer>;
  private _linkCache: MemCacheObject<StructureLink>;
  private _constructionSiteCache: MemCacheObject<ConstructionSite>;

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub, true);
    this.memory = Mem.wrap(flag.memory, 'energy_source', {});

    this._containerCache = new MemCacheObject(this.memory, 'container');
    this._linkCache = new MemCacheObject<StructureLink>(this.memory, 'link');
    this._constructionSiteCache = new MemCacheObject(this.memory, 'construction_site');

    this.defineStructurePosition();
  }

  get container(): StructureContainer | null {
    return this._containerCache.value;
  }

  get link(): StructureLink | null {
    return this._linkCache.value;
  }

  private defineStructurePosition() {
    let path = null;

    log.debug(`defineStructurePosition ${this.pos}`);

    if (!this.memory.containerPos || !this.memory.linkPos) {
      path = this.pos.findPathTo(this.hub.pos, { ignoreCreeps: true });
    }

    if (path) {
      log.debug(`> path[0]: ${path[0].x},${path[0].y}; path[1]: ${path[1].x},${path[1].y}; `)
    }
    if (!this.memory.containerPos && path) {
      // Need to determine container position
      const step = path[0];

      if (step.x == 1 || step.y == 1 || step.x == 48 || step.y == 48) {

        const coord = findNearValidPos({ x: step.x, y: step.y }, this.pos.roomName);
        if (coord) {
          this.memory.containerPos = serializePos(new RoomPosition(coord.x, coord.y, this.pos.roomName));
        }

      } else {
        this.memory.containerPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
      }

    }

    this.containerPos = deserializePos(this.memory.containerPos!);

    this.isOutpost = this.pos.roomName != this.hub.pos.roomName;

    log.debug(`${this.print} constructor this.memory.linkPos: ${this.memory.linkPos}, path: ${path}, this.isOutpost: ${this.isOutpost}`)

    if (!this.memory.linkPos && path && !this.isOutpost) {
      log.debug(`${this.print} Define link pos`)
      const stepIndex = Math.min(1, path.length);
      const step = path[stepIndex];
      if (step.x == 1 || step.y == 1 || step.x == 48 || step.y == 48) {
        log.debug(`${this.print} Oups ! Invalid step`);
        const coord = findNearValidPos({ x: this.containerPos.x, y: this.containerPos.y }, this.pos.roomName);
        log.debug(`> new coord : ${JSON.stringify(coord)}`);
        if (coord) {
          this.memory.linkPos = serializePos(new RoomPosition(coord.x, coord.y, this.pos.roomName));
        }
      } else {
        this.memory.linkPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
      }
    }


    if (!this.isOutpost && this.memory.linkPos) {
      this.linkPos = deserializePos(this.memory.linkPos);
    }
  }

  spawnDaemons(): void {

    if (!this.daemons.harvest) {
      const source = _.find(this.hub.sources, source => source.pos.roomName == this.pos.roomName && source.pos.x == this.pos.x && source.pos.y == this.pos.y);
      if (source) {
        const priority = 50 - 1 / ((this.flag.memory as any)['hubDistance'] ?? 1);
        this.daemons.harvest = new HarvestDaemon(this.hub, this, source, priority);
      } else {
        log.error(`${this.print} No source available`)
      }
    }
  }

  private buildHandler() {

    /*
    if (this.pos.roomName != this.hub.room.name) {
      return;
    }
    */

    if (this.hub.level < EnergySourceDirective.Setting.rclContainer) {
      return;
    }

    if (!this._containerCache.value && !this._constructionSiteCache.value && !this.hub.dispatcher.isDaemonSuspended(this.daemons.harvest)) {
      // Create Container if required
      const r = this.containerPos.createConstructionSite(STRUCTURE_CONTAINER);
      if (r != OK) {
        log.warning(`${this.print} cannot create construction site ${r}`);
      }
    }

    log.debug(`${this.print} Link required :${linksSourceMax(this.hub.level)}, this.isOutpost: ${this.isOutpost}, this._linkCache.value: ${this._linkCache.value}`)

    if (this.linkPos && !this.isOutpost && !this._linkCache.value && !this._constructionSiteCache.value) {
      if (this.hub.links.length >= 1 && this.hub.links.length < linksSourceMax(this.hub.level)) {
        // Create Link if required
        const r = this.linkPos.createConstructionSite(STRUCTURE_LINK);
        if (r != OK) {
          log.warning(`${this.print} cannot create construction site ${r} at ${this.linkPos}`);
        }
      }
    }


  }

  refresh(): void {
    super.refresh();

    this.memory = Mem.wrap(this.flag.memory, 'energy_source', {});

    this._containerCache.refresh(this.memory);
    if (!this.isOutpost) {
      this._linkCache.refresh(this.memory);
    }
    this._constructionSiteCache.refresh(this.memory);


    if (!Game.rooms[this.pos.roomName]) {
      // Room unreachable
      return;
    }

    if (!this._containerCache.value) {
      this._containerCache.value = _.find(this.containerPos.lookFor(LOOK_STRUCTURES), structure => structure.structureType == STRUCTURE_CONTAINER) as StructureContainer ?? null;
      // this._containerCache.value = findClosestByLimitedRange(this.pos, this.hub.containersByRooms[this.room.name] ?? [], 5);
    }

    if (!this.isOutpost && !this._linkCache.isValid()) {
      this._linkCache.value = _.find(this.linkPos.lookFor(LOOK_STRUCTURES), structure => structure.structureType == STRUCTURE_LINK) as StructureLink ?? null;
      // this._linkCache.value = findClosestByLimitedRange(this.pos, this.hub.links, 5);
    }

    if (!this._constructionSiteCache.value) {
      const containerConstructionSite = _.find(this.containerPos.lookFor(LOOK_CONSTRUCTION_SITES), site => site.structureType == STRUCTURE_CONTAINER);
      if (containerConstructionSite) {
        this._constructionSiteCache.value = containerConstructionSite;
      } else {
        const containerLinkSite = _.find(this.containerPos.lookFor(LOOK_CONSTRUCTION_SITES), site => site.structureType == STRUCTURE_LINK);
        if (containerLinkSite) {
          this._constructionSiteCache.value = containerLinkSite;
        }
      }

      // this._constructionSiteCache.value = findClosestByLimitedRange(this.pos, this.hub.constructionSitesByRooms[this.room.name] ?? [], 5);
    }


  }

  init(): void {

    if (!Game.rooms[this.pos.roomName]) {
      // Room unreachable
      return;
    }

    /*
    if (this._linkCache.isValid() && this.daemons.hauler) {
      this.daemons.hauler.maxQuantity = 0;
    } else if (this.daemons.hauler) {
      this.daemons.hauler.maxQuantity = 1;
    }
    */

    this.buildHandler();
  }

  run(): void {

  }

}