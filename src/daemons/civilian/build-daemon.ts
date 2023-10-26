import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, BUIDER_TEMPLATE } from "agent/agent-setup";
import { BuilderRole, RepairRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { Hub } from "hub/Hub";
import { BuildPriorities } from "hub/room-planner/room-priorities-structures";
import _, { Dictionary } from "lodash";
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
    super(hub, initializer, 'build');
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

    this.wishList(2, setup, options);

  }

  private spawnRepairerHandler() {

    if (this.hub.structures.length == 0) {
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

    return _.chain(this.hub.constructionSites ?? [])//
      .orderBy(site => siteScore(this.hub, site), ['desc'])//
      .first()//
      .value();

  }

  private getBestRepair(): Structure | null {
    return _.chain(this.hub.structures ?? [])//
      .filter(structure => structure.hits < structure.hitsMax)//
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
    if (this.hub.constructionSites.length > 0) {
      this.spawnBuilderHandler();
    }

    this.spawnRepairerHandler();


    /**
     * Init
     */
    if (!this.constructionSite) {
      this.constructionSite = this.getBestConstruction();
    }

    if (!this.repairCache.value || this.repairCache.value.hits == this.repairCache.value.hitsMax) {
      this.repairCache.value = this.getBestRepair();
    }

    /**
     * Handle resources
     */
    if (this.constructionSite && (this.agentsByRole['builder'] ?? []).length > 0) {

      const drops = _.filter(this.hub.dropsByRooms[this.pos.roomName] ?? [], drop => drop.resourceType == RESOURCE_ENERGY);
      const drop = findClosestByLimitedRange(this.constructionSite.pos, drops, 5);

      const amount = 300 - (drop?.amount ?? 0)

      if (amount > 0) {
        this.hub.logisticsNetwork.requestDrop(this.constructionSite.pos, RESOURCE_ENERGY, amount);
      }



    }


  }

  run(): void {


    this.autoRun(this.agentsByRole['builder'], agent => {

      if (this.constructionSiteCache.value) {
        return BuilderRole.pipeline(this.hub, agent, this.constructionSiteCache.value);
      }

      if (this.repairCache.value) {
        return RepairRole.pipeline(this.hub, agent, this.repairCache.value);
      }

      return [];
    });

    this.autoRun(this.agentsByRole['repairer'], agent => {

      if (this.repairCache.value) {
        return RepairRole.pipeline(this.hub, agent, this.repairCache.value);
      }

      if (this.constructionSiteCache.value) {
        return BuilderRole.pipeline(this.hub, agent, this.constructionSiteCache.value);
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