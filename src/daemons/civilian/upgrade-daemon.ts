import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, countValidBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HAULER_TEMPLATE, UPGRADER_BATTERY_TEMPLATE, UPGRADER_TEMPLATE } from "agent/agent-setup";
import { UpgradeRole } from "agent/roles/roles";
import { UpgradeArea } from "area/hub/upgrade-area";
import { Daemon } from "daemons/daemon";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";
import { Settings } from "settings";
import { log } from "utils/log";

export class UpgradeDaemon extends Daemon {

  static Settings = {
    boostEnergyAmount: 30000, // 75000
  };

  upgradeArea: UpgradeArea;

  constructor(hub: Hub, upgradeArea: UpgradeArea) {
    super(hub, upgradeArea, 'upgrade', RunActivity.Upgrade);
    this.upgradeArea = upgradeArea;
  }

  get link() {
    return this.upgradeArea.link;
  }

  get container() {
    return this.upgradeArea.container;
  }

  get store(): Store<RESOURCE_ENERGY, false> | null {

    if (this.upgradeArea.link) {
      return this.upgradeArea.link.store;
    }
    if (this.upgradeArea.container) {
      return this.upgradeArea.container.store as Store<RESOURCE_ENERGY, false>;
    }

    return null;
  }

  private spawnHandler() {

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.upgrader
    };

    const isHubMaxLevel = this.hub.level == 8;

    const template = this.upgradeArea.container ? UPGRADER_BATTERY_TEMPLATE : UPGRADER_TEMPLATE;

    const bodyParts = isHubMaxLevel ? template.bodyParts[0] : selectBodyParts(template, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'upgrader',
      bodyParts: bodyParts
    };

    if (isHubMaxLevel) {
      if (this.hub.controller.ticksToDowngrade < 100000) {
        this.wishList(1, setup, options);
      }
      return;
    }

    const quantity = (this.hub.links.length == 0 || (this.hub.storage && this.hub.storage?.store.getUsedCapacity(RESOURCE_ENERGY) > UpgradeDaemon.Settings.boostEnergyAmount)) ? 2 : 1;

    const energySource = this.link ?? this.container

    if (energySource && energySource.store.getUsedCapacity(RESOURCE_ENERGY) > energySource.store.getCapacity(RESOURCE_ENERGY) * 0.85 && (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 15000)) {
      this.wishList(Math.min(4, this.agents.length + 1), setup, options);
    } else {
      this.wishList(quantity, setup, options);
    }

  }

  init(): void {

    const outputRate = _.sum(this.agents.map(agent => countValidBodyPart(agent.creep, WORK))) * 2;
    this.resourceFlowStats.pushOutput(RESOURCE_ENERGY, outputRate);

    if (this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.upgradeMinLinkEnergy) { // && this.hub.controller.ticksToDowngrade < 50000
      // Request energy
      this.hub.linkNetwork.requestInput(this.link);

      if (this.hub.level < 6) {
        // Request energy by hauler if hub level cannot allow full link number
        this.hub.logisticsNetwork.requestInput(this.link, RESOURCE_ENERGY);

        if (this.hub.storage && this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Settings.upgradeMinStorageEnergy) {
          // Allow take energy from storage
          this.hub.logisticsNetwork.removeRequest(this.hub.storage, RESOURCE_ENERGY);
          this.hub.logisticsNetwork.requestOutput(this.hub.storage, RESOURCE_ENERGY);
        }
      }
    }
    /*
    if ((!this.upgradeArea.container && !this.link) || this.upgradeArea.container) {
      // Spawn upgrader using energy from drop, or container
      this.spawnHandler();
    }
    */
    this.spawnHandler();

    if (!this.link && this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Energy required into container

      const bestBodyParts = selectBodyParts(HAULER_TEMPLATE, this.hub.room.energyCapacityAvailable);
      const bestCarryPerAgent = countBodyPart(bestBodyParts, CARRY) * CARRY_CAPACITY;
      const minEnergyToRequest = Math.max(bestCarryPerAgent, 1000);

      if ((!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) && this.container.store.getFreeCapacity(RESOURCE_ENERGY) > minEnergyToRequest) {
        // Request energy into the container
        this.hub.logisticsNetwork.requestInput(this.container, RESOURCE_ENERGY);
      }

      if (this.hub.level < 8 && this.hub.storage && this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 40000 && this.container.store.getFreeCapacity(RESOURCE_ENERGY) > minEnergyToRequest) {
        // Request energy from Storage If no link available
        this.hub.logisticsNetwork.removeRequest(this.hub.storage, RESOURCE_ENERGY);
        this.hub.logisticsNetwork.requestOutput(this.hub.storage, RESOURCE_ENERGY);
      }

    }

    if (this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) < this.link.store.getCapacity(RESOURCE_ENERGY) * 0.15) {
      // Require energy into link if quantity is very low
      this.hub.logisticsNetwork.requestInput(this.link, RESOURCE_ENERGY);
    }

    if (this.container && this.hub.storage) {
      // Vacuum container for all other items than RESOURCE_ENERGY
      for (const resource in this.container.store) {
        if (resource != RESOURCE_ENERGY && this.hub.storage.store.getUsedCapacity(resource as ResourceConstant) < Settings.hubStorageMaxResource) {
          this.hub.logisticsNetwork.requestOutput(this.container, resource as ResourceConstant);
          this.hub.logisticsNetwork.requestInput(this.hub.storage, resource as ResourceConstant);
        }
      }
    }

    if (!this.container && !this.link && this.agents.length > 0) {
      // Request energy on ground
      this.hub.logisticsNetwork.requestDrop(this.upgradeArea.dropPos, RESOURCE_ENERGY);
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => UpgradeRole.pipeline(this.hub, agent, this.container, this.link));

  }

}