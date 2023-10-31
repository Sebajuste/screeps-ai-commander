import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, UPGRADER_BATTERY_TEMPLATE, UPGRADER_TEMPLATE } from "agent/agent-setup";
import { UpgradeRole } from "agent/roles/roles";
import { UpgradeArea } from "area/hub/upgrade-area";
import { Daemon } from "daemons/daemon";
import { Hub, RunActivity } from "hub/Hub";
import { log } from "utils/log";

export class UpgradeDaemon extends Daemon {

  upgradeArea: UpgradeArea;

  constructor(hub: Hub, upgradeArea: UpgradeArea) {
    super(hub, upgradeArea, 'upgrade', RunActivity.Upgrade);
    this.upgradeArea = upgradeArea;
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.upgrader
    };

    const template = this.upgradeArea.container ? UPGRADER_BATTERY_TEMPLATE : UPGRADER_TEMPLATE;

    const bodyParts = selectBodyParts(template, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'upgrader',
      bodyParts: bodyParts
    };

    const quantity = this.hub.links.length == 0 ? 2 : 1;

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
      if ((!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 5000) && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) > 400) {
        this.hub.logisticsNetwork.requestInput(this.upgradeArea.container, RESOURCE_ENERGY);
      }

      if (this.hub.level < 8 && this.hub.storage && this.hub.storage.store.getUsedCapacity() > 50000 && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) >= 1000) {
        // Request energy from Storage If no link available
        this.hub.logisticsNetwork.removeRequest(this.hub.storage, RESOURCE_ENERGY);
        this.hub.logisticsNetwork.requestOutput(this.hub.storage, RESOURCE_ENERGY);
      }

    }
    if (!this.upgradeArea.container && this.agents.length > 0) {
      // Request energy on ground
      log.debug(`Upgrade energy drop at `, this.upgradeArea.dropPos);
      this.hub.logisticsNetwork.requestDrop(this.upgradeArea.dropPos, RESOURCE_ENERGY);
    }

  }

  run(): void {

    // const storeStructure = this.upgradeArea.link && this.upgradeArea.link.store.getUsedCapacity(RESOURCE_ENERGY) > 0 ? this.upgradeArea.link : this.upgradeArea.container;

    this.autoRun(this.agents, agent => UpgradeRole.pipeline(this.hub, agent, this.upgradeArea.container, this.upgradeArea.link));

  }

}