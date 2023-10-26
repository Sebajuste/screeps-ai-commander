import { Area } from "area/Area";
import { UpgradeDaemon } from "daemons";
import { TowerDaemon } from "daemons/military/tower-daemon";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { deserializePos, serializePos, serializeTasks } from "task/task-initializer";
import { findClosestByLimitedRange } from "utils/util-pos";

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
  container?: StructureContainer | null;
  link?: StructureLink | null;
  constructionSite?: ConstructionSite | null;

  constructor(hub: Hub) {
    super(hub, hub.controller, 'upgradeArea');

    this.memory = Mem.wrap(this.hub.memory, 'upgradeArea');

    let steps = null;

    if (!this.memory.containerPos || !this.memory.containerPos) {
      steps = this.pos.findPathTo(this.hub.pos, { ignoreCreeps: true });
    }

    if (!this.memory.containerPos && steps) {
      const stepIndex = Math.min(1, steps.length);
      const step = steps[stepIndex];
      this.memory.containerPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    if (!this.memory.linkPos && steps) {
      const stepIndex = Math.min(2, steps.length);
      const step = steps[stepIndex];
      this.memory.linkPos = serializePos(new RoomPosition(step.x, step.y, this.pos.roomName));
    }

    this.dropPos = deserializePos(this.memory.containerPos!);
  }

  spawnDaemons(): void {

    this.daemons.upgrade = new UpgradeDaemon(this.hub, this);

    if (this.hub.towers.length > 0) {
      this.daemons.tower = new TowerDaemon(this.hub, this);
    }

  }

  refresh() {
    super.refresh();

    const containers = _.filter(this.hub.structuresByRooms[this.room.name], structure => structure.structureType == STRUCTURE_CONTAINER) as StructureContainer[];
    this.container = findClosestByLimitedRange(this.pos, containers, 5);

    this.link = findClosestByLimitedRange(this.pos, this.hub.links, 5);

    this.constructionSite = findClosestByLimitedRange(this.pos, this.hub.constructionSitesByRooms[this.room.name], 5);

  }

  init(): void {

    if (!this.container && !this.constructionSite) {
      // Require container
      this.dropPos.createConstructionSite(STRUCTURE_CONTAINER);
    }

    if (!this.link && !this.constructionSite && this.hub.level >= 5) {
      this.dropPos.createConstructionSite(STRUCTURE_LINK);
    }

  }

  run(): void {

  }

}