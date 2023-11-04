import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HARVEST_BASIC_STRUCTURE_TEMPLATE } from "agent/agent-setup";
import { MinerRole } from "agent/roles/roles";
import { MineralArea } from "area/hub/mineral-area";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { Settings } from "settings";



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

  requireMineral(): boolean {

    const containerAmount = this.minerArea.container ? (this.minerArea.container.store.getUsedCapacity(this.minerArea.mineral.mineralType) ?? 0) : 0;

    return this.hub.storage != undefined &&
      (this.hub.storage.store.getUsedCapacity(this.minerArea.mineral.mineralType) + containerAmount) < Settings.hubStorageMaxResource;

  }

  init(): void {

    if (this.minerArea.container && this.minerArea.mineral.mineralAmount > 0 && this.requireMineral()) {
      this.spawnHandler();
    }

    const container = this.minerArea.container;
    if (container && container.store.getUsedCapacity(this.minerArea.mineral.mineralType) > 0 && this.requireMineral()) {
      this.hub.logisticsNetwork.requestOutput(container, this.minerArea.mineral.mineralType);
      this.hub.logisticsNetwork.requestInput(this.hub.storage!, this.minerArea.mineral.mineralType);
    }

  }

  run(): void {

    if (this.minerArea.mineral.mineralAmount == 0 || !this.minerArea.extractor || !this.minerArea.container || !this.requireMineral()) {
      // Sleep until energy respawn, or structure dependencies ready, or storage is full
      return;
    }

    this.autoRun(this.agents, agent => MinerRole.pipeline(this.hub, agent, this.minerArea.mineral, this.minerArea.extractor, this.minerArea.container));

  }

}