import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, UPGRADER_BATTERY_TEMPLATE, UPGRADER_TEMPLATE } from "agent/agent-setup";
import { UpgradeRole } from "agent/roles/roles";
import { UpgradeArea } from "area/hub/upgrade-area";
import { Daemon } from "daemons/daemon";
import { Hub } from "hub/Hub";
import { log } from "utils/log";

export class UpgradeDaemon extends Daemon {

  upgradeArea: UpgradeArea;

  constructor(hub: Hub, upgradeArea: UpgradeArea) {
    super(hub, upgradeArea, 'upgrade');
    this.upgradeArea = upgradeArea;
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.upgrader
    };

    const template = this.upgradeArea.container ? UPGRADER_BATTERY_TEMPLATE : UPGRADER_TEMPLATE;
    const quantity = this.upgradeArea.container && this.upgradeArea.container.store.getUsedCapacity(RESOURCE_ENERGY) < 1000 ? 1 : 2;

    const bodyParts = selectBodyParts(template, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'upgrader',
      bodyParts: bodyParts
    };

    this.wishList(quantity, setup, options);

  }

  init(): void {
    this.spawnHandler();

    if (this.upgradeArea.link) {
      this.hub.linkNetwork.requestInput(this.upgradeArea.link);
    }

    if (this.upgradeArea.container && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Energy required into container

      // Request energy into the container
      this.hub.logisticsNetwork.requestInput(this.upgradeArea.container, RESOURCE_ENERGY);

      if (this.hub.level < 8 && this.hub.storage && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) >= 1000) {
        // Request energy from Storage
        this.hub.logisticsNetwork.removeRequest(this.hub.storage, RESOURCE_ENERGY);
        this.hub.logisticsNetwork.requestOutput(this.hub.storage, RESOURCE_ENERGY);
      }

    } else if (this.agents.length > 0) {
      // Request energy on ground
      this.hub.logisticsNetwork.requestDrop(this.upgradeArea.dropPos, RESOURCE_ENERGY);
    }

  }

  run(): void {

    const storeStructure = this.upgradeArea.link && this.upgradeArea.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0 ? this.upgradeArea.link : this.upgradeArea.container;

    this.autoRun(this.agents, agent => UpgradeRole.pipeline(this.hub, agent, storeStructure));

  }

}