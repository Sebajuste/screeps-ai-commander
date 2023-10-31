import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HARVEST_BASIC_STRUCTURE_TEMPLATE } from "agent/agent-setup";
import { MinerRole } from "agent/roles/roles";
import { MineralArea } from "area/hub/mineral-area";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { Mem, MemCacheObject } from "memory/Memory";
import { Settings } from "settings";
import { serializePos } from "task/task-initializer";
import { log } from "utils/log";



export class MinerDaemon extends Daemon {


  minerArea: MineralArea;

  constructor(hub: Hub, minerArea: MineralArea) {
    super(hub, minerArea, 'miner', RunActivity.Miner);
    this.minerArea = minerArea;
  }



  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.miner
    };

    const bodyParts = selectBodyParts(HARVEST_BASIC_STRUCTURE_TEMPLATE, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'miner',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  init(): void {

    if (this.minerArea.container && this.minerArea.mineral.mineralAmount > 0) {
      this.spawnHandler();
    }

    const storage = this.hub.storage;
    const container = this.minerArea.container;
    if (container && storage && container.store.getUsedCapacity(this.minerArea.mineral.mineralType) > 0 && storage.store.getUsedCapacity(this.minerArea.mineral.mineralType) < Settings.hubStorageMaxResource) {
      this.hub.logisticsNetwork.requestOutput(container, this.minerArea.mineral.mineralType);
      this.hub.logisticsNetwork.requestInput(storage, this.minerArea.mineral.mineralType);
    }

  }

  run(): void {

    if (this.minerArea.mineral.mineralAmount == 0 || !this.minerArea.extractor || !this.minerArea.container) {
      // Sleep until energy respawn, or structure dependecies ready
      return;
    }

    this.autoRun(this.agents, agent => MinerRole.pipeline(this.hub, agent, this.minerArea.mineral, this.minerArea.extractor, this.minerArea.container));

  }

}