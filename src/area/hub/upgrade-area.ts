import { Area } from "area/Area";
import { UpgradeDaemon } from "daemons";
import { TowerDaemon } from "daemons/military/tower-daemon";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { deserializePos, serializePos, serializeTasks } from "task/task-initializer";
import { log } from "utils/log";
import { findAtPos, findClosestByLimitedRange } from "utils/util-pos";

interface UpgradeAreaMemory {
  containerPos?: string;
  linkPos?: string;
}

export class UpgradeArea extends Area {

  memory: UpgradeAreaMemory;

  daemons: {
    upgrade: UpgradeDaemon,
    tower?: TowerDaemon
  }

  dropPos: RoomPosition;
  linkPos: RoomPosition;

  // private _containerCache: MemCacheObject<StructureContainer>;
  private _container?: StructureContainer;
  private _linkCache: MemCacheObject<StructureLink>;
  private _constructionSiteCache: MemCacheObject<ConstructionSite>;
  private _link?: StructureLink | null;

  constructor(hub: Hub) {
    super(hub, hub.controller, 'upgradeArea');

    this.memory = Mem.wrap(this.hub.memory, 'upgradeArea');

    this._linkCache = new MemCacheObject<StructureLink>(this.memory, 'link');
    this._constructionSiteCache = new MemCacheObject<ConstructionSite>(this.memory, 'constructionSite');

    let steps = null;

    if (!this.memory.containerPos || !this.memory.containerPos) {
      steps = this.hub.roomPlanner.roadPlanner.findPath(this.pos, this.hub.pos); // Using planned road to find object position
    }

    if (!this.memory.containerPos && steps) {
      const stepIndex = Math.min(2, steps.length);
      const step = steps[stepIndex];
      this.memory.containerPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    if (!this.memory.linkPos && steps) {
      const stepIndex = Math.min(3, steps.length);
      const step = steps[stepIndex];
      this.memory.linkPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    this.dropPos = deserializePos(this.memory.containerPos!);
    this.linkPos = deserializePos(this.memory.linkPos!);
  }

  get container(): StructureContainer | undefined {
    if (!this._container) {
      this._container = findAtPos(this.dropPos, this.hub.containersByRooms[this.pos.roomName] ?? []);
    }
    return this._container!;
  }

  get link(): StructureLink | null | undefined {
    if (!this._link) {
      this._link = findAtPos(this.linkPos, this.hub.links ?? []);
    }
    return this._link;
  }

  get constructionSite(): ConstructionSite | null {
    return this._constructionSiteCache.value;
  }


  spawnDaemons(): void {

    this.daemons.upgrade = new UpgradeDaemon(this.hub, this);

    if (this.hub.towers.length > 0) {
      this.daemons.tower = new TowerDaemon(this.hub, this);
    }

  }

  refresh() {
    super.refresh();

    this._container = undefined;
    /*
    this._containerCache.refresh(this.memory);
    if (!this._containerCache.isValid()) {
      this._containerCache.value = findClosestByLimitedRange(this.pos, this.hub.containersByRooms[this.room.name] ?? [], 5);
    }
    */

    this._link = this.pos.findClosestByRange(this.hub.links);

    this._linkCache.refresh(this.memory);
    if (!this._linkCache.isValid()) {
      this._linkCache.value = findClosestByLimitedRange(this.pos, this.hub.links, 5);
    }

    this._constructionSiteCache.refresh(this.memory);
    if (!this._constructionSiteCache.isValid()) {
      this._constructionSiteCache.value = findClosestByLimitedRange(this.pos, this.hub.constructionSitesByRooms[this.room.name] ?? [], 5);
    }

  }

  init(): void {

    if (!this.link && !this.container && !this.constructionSite && this.hub.level < 5) {
      // Require container
      this.dropPos.createConstructionSite(STRUCTURE_CONTAINER);
    }

    if (!this.link && !this.constructionSite && this.hub.level >= 5) {
      // Require link
      this.linkPos.createConstructionSite(STRUCTURE_LINK);
    }

    if (this.link && this.container) {
      // Dismantle obselete container
      this.hub.roomPlanner.addDismantle(this.container);
    }

  }

  run(): void {

  }

}