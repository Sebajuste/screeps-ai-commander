import { Commander } from "Commander";
import { HarvestDaemon, HaulerDaemon } from "daemons";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { log } from "utils/log";
import { findClosestByLimitedRange } from "utils/util-pos";



interface EnergySourceMemory {
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

  containerCache: MemCacheObject<StructureContainer>;
  constructionSiteCache: MemCacheObject<ConstructionSite>;

  constructor(commander: Commander, flag: Flag, hub: Hub) {
    super(commander, flag, hub, true);
    this.memory = Mem.wrap(flag.memory, 'energy_source', {});
    this.containerCache = new MemCacheObject(this.memory, 'container');
    this.constructionSiteCache = new MemCacheObject(this.memory, 'construction_site');
  }

  get container(): StructureContainer | null {
    return this.containerCache.value;
  }

  spawnDaemons(): void {

    const source = _.find(this.hub.sources, source => source.pos.roomName == this.pos.roomName && source.pos.x == this.pos.x && source.pos.y == this.pos.y);

    if (source) {
      const priority = 50 - 1 / ((this.flag.memory as any)['hubDistance'] ?? 1);
      if (!this.daemons.harvest) {
        this.daemons.harvest = new HarvestDaemon(this.hub, this, source, priority);
      }
      if (!this.daemons.hauler) {
        this.daemons.hauler = new HaulerDaemon(this.hub, this, priority, 1);
      }
    } else {
      log.error(`${this.print} No source available`)
    }
  }

  private buildHandler() {

    if (this.hub.level < EnergySourceDirective.Setting.rclContainer) {
      return;
    }

    if (!this.containerCache.value && !this.constructionSiteCache.value) {
      // Create Container if required
      const path = this.pos.findPathTo(this.hub.pos, { ignoreCreeps: true });
      const step = path[0];

      const r = this.room.createConstructionSite(step.x, step.y, STRUCTURE_CONTAINER);
      if (r != OK) {
        log.warning(`${this.print} cannot create construction site ${r}`);
      }
    }


  }

  refresh(): void {
    super.refresh();

    this.memory = Mem.wrap(this.flag.memory, 'energy_source', {});

    this.constructionSiteCache.refresh(this.memory);
    this.containerCache.refresh(this.memory);

    if (!Game.rooms[this.pos.roomName]) {
      // Room unreachable
      return;
    }

    if (!this.containerCache.value) {
      this.containerCache.value = findClosestByLimitedRange(this.pos, this.hub.containersByRooms[this.room.name] ?? [], 5);
    }

    if (!this.constructionSiteCache.value) {
      this.constructionSiteCache.value = findClosestByLimitedRange(this.pos, this.hub.constructionSitesByRooms[this.room.name] ?? [], 5);
    }


  }

  init(): void {

    if (!Game.rooms[this.pos.roomName]) {
      // Room unreachable
      return;
    }

    // this.buildHandler();
  }

  run(): void {

  }

}