import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, BUIDER_TEMPLATE } from "agent/agent-setup";
import { BuilderRole, RepairRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { Hub, RunActivity } from "hub/Hub";
import { BuildPriorities } from "hub/room-planner/room-priorities-structures";
import _ from "lodash";
import { Mem, MemCacheObject } from "memory/Memory";
import { log } from "utils/log";
import { findClosestByLimitedRange, getMultiRoomRange } from "utils/util-pos";


interface BuildMemory {
  bestConstruction?: Id<_HasId>
  bestRepair?: Id<_HasId>;
}

export class BuildDaemon extends Daemon {

  initializer: Actor;
  memory: BuildMemory;

  private constructionSiteCache: MemCacheObject<ConstructionSite>;
  private repairCache: MemCacheObject<Structure>;

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'build', RunActivity.Build);
    this.initializer = initializer;
    this.memory = Mem.wrap(initializer.memory, 'build_daemon', {});

    this.constructionSiteCache = new MemCacheObject(this.memory, 'construction');
    this.repairCache = new MemCacheObject(this.memory, 'repair');
  }

  get constructionSite(): ConstructionSite | null {
    return this.constructionSiteCache.value;
  }

  set constructionSite(value: ConstructionSite | null) {
    this.constructionSiteCache.value = value;
  }

  private spawnBuilderHandler() {

    if (this.hub.constructionSites.length == 0) {
      // No structure to build
      return;
    }

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.builder
    };

    const bodyParts = selectBodyParts(BUIDER_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'builder',
      bodyParts: bodyParts
    };

    this.wishList(this.hub.level < 3 ? 2 : 1, setup, options);

  }

  private spawnRepairerHandler() {

    if (this.hub.structures.length == 0 && (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 2000)) {
      // No structure to repair
      return;
    }

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.builder
    };

    const bodyParts = selectBodyParts(BUIDER_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'repairer',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  private getBestConstruction(): ConstructionSite | null {

    if (this.hub.constructionSites.length == 0) {
      return null;
    }

    return _.chain(this.hub.runLevel & RunActivity.Outpost ? this.hub.constructionSites : this.hub.constructionSitesByRooms[this.pos.roomName] ?? [])//
      .filter(site => Game.rooms[site.pos.roomName] != undefined)//
      .orderBy(site => siteScore(this.hub, site), ['desc'])//
      .first()//
      .value();

  }

  private getBestRepair(): Structure | null {

    return _.chain(this.hub.runLevel & RunActivity.Outpost ? this.hub.structures : this.hub.structuresByRooms[this.pos.roomName] ?? [])//
      .filter(structure => structure.hits < structure.hitsMax && Game.rooms[structure.pos.roomName] != undefined && !this.hub.roomPlanner.isDismantle(structure))//
      .orderBy(['hitsMax'], ['asc'])//
      .first()//
      .value();
  }

  refresh(): void {
    super.refresh();
    this.memory = Mem.wrap(this.initializer.memory, 'build_daemon', {});

    this.constructionSiteCache.refresh(this.memory);
    this.repairCache.refresh(this.memory);
  }

  init(): void {

    const haveOutpost = this.hub.haveActivity(RunActivity.Outpost);
    if (haveOutpost ? this.hub.constructionSites.length > 0 : (this.hub.constructionSitesByRooms[this.pos.roomName] ?? []).length > 0) {
      this.spawnBuilderHandler();
    }

    if (haveOutpost) {
      // Repair only for outpost structures

      this.spawnRepairerHandler();

      if (!this.repairCache.value || this.repairCache.value.hits == this.repairCache.value.hitsMax) {
        this.repairCache.value = this.getBestRepair();
      }
    }


    /**
     * Init
     */
    if (!this.constructionSite && this.hub.constructionSites.length > 0) {
      this.constructionSite = this.getBestConstruction();
    }


    /**
     * Handle resources
     */
    if (this.constructionSite && (this.agentsByRole['builder'] ?? []).length > 0 && this.hub.level < 4) {

      const drops = _.filter(this.hub.dropsByRooms[this.pos.roomName] ?? [], drop => drop.resourceType == RESOURCE_ENERGY && Game.rooms[drop.pos.roomName] != undefined);
      const drop = findClosestByLimitedRange(this.constructionSite.pos, drops, 5);

      const energyRequired = Math.floor((this.constructionSite.progressTotal - this.constructionSite.progress) / 5);
      const amount = energyRequired - (drop?.amount ?? 0);

      log.debug(`build site energyRequired: ${energyRequired}, amount: ${amount} `);

      if (amount > 0) {
        log.debug(`Build energy drop at `, this.constructionSite.pos);
        this.hub.logisticsNetwork.requestDrop(this.constructionSite.pos, RESOURCE_ENERGY, amount);
      }

    }


  }

  run(): void {


    this.autoRun(this.agentsByRole['builder'], agent => {


      if (this.constructionSite) {
        if (Game.rooms[this.constructionSite.pos.roomName] == undefined) {
          this.constructionSite = null;
          return [];
        } else {
          return BuilderRole.pipeline(this.hub, agent, this.constructionSite);
        }

      }

      if (this.repairCache.value) {
        if (Game.rooms[this.repairCache.value.pos.roomName] == undefined) {
          this.repairCache.value = null;
          return [];
        } else {
          return RepairRole.pipeline(this.hub, agent, this.repairCache.value);
        }
      }

      return [];
    });

    this.autoRun(this.agentsByRole['repairer'], agent => {

      if (this.repairCache.value) {
        return RepairRole.pipeline(this.hub, agent, this.repairCache.value);
      }

      if (this.constructionSite) {
        return BuilderRole.pipeline(this.hub, agent, this.constructionSite);
      }

      return [];
    });

  }

}

function siteScore(hub: Hub, site: ConstructionSite): number {
  const mainRoomScore = site.pos.roomName == hub.pos.roomName ? 100 : 1;
  const typeScore = Math.max(1, BuildPriorities.length - _.indexOf(BuildPriorities, site.structureType));
  const distanceScore = 1 / getMultiRoomRange(hub.pos, site.pos);
  const buildScore = site.progressTotal < 5000 ? (site.progress / site.progressTotal) : ((site.progress / site.progressTotal) * 0.5);
  return mainRoomScore + typeScore * buildScore * distanceScore;
}