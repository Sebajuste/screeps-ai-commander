import { Area } from "area/Area";
import { CommandCenterDaemon } from "daemons/civilian/command-center-daemon";
import { SupplyDaemon } from "daemons/civilian/supply-daemon";
import { Hub } from "hub/Hub";
import { findClosestByLimitedRange } from "utils/util-pos";

export class HubCenterArea extends Area {

  storage: StructureStorage;
  link?: StructureLink;
  commanderSpawn?: StructureSpawn;
  towers: StructureTower[];
  terminal?: StructureTerminal;
  nuker?: StructureNuker;

  daemons: {
    supply: SupplyDaemon,
    commander: CommandCenterDaemon
  }

  constructor(hub: Hub, storage: StructureStorage) {
    super(hub, storage, 'hubCenter');
    this.storage = storage;
    this.populateStructure();
  }

  private populateStructure() {
    this.link = findClosestByLimitedRange(this.storage.pos, this.hub.links, 5) as StructureLink ?? undefined;
    this.commanderSpawn = this.hub.spawns.find(spawn => spawn.pos.roomName == this.pos.roomName && spawn.pos.x == this.pos.x && spawn.pos.y == this.pos.y - 1);
    this.towers = this.pos.findInRange(this.hub.towers, 1);
    this.terminal = this.hub.terminal;
    this.nuker = this.hub.nuker;
  }

  spawnDaemons(): void {
    this.daemons.supply = new SupplyDaemon(this);
    if (this.link) {
      this.daemons.commander = new CommandCenterDaemon(this, 10);
    }

  }

  refresh(): void {
    super.refresh();
    this.populateStructure();
  }

  init(): void {
  }

  run(): void {
  }

}