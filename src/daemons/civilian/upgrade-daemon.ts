import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countValidBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, UPGRADER_BATTERY_TEMPLATE, UPGRADER_TEMPLATE } from "agent/agent-setup";
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

    const template = this.upgradeArea.container ? UPGRADER_BATTERY_TEMPLATE : UPGRADER_TEMPLATE;

    const bodyParts = selectBodyParts(template, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'upgrader',
      bodyParts: bodyParts
    };

    const quantity = this.hub.level < 8 && (this.hub.links.length == 0 || (this.hub.storage && this.hub.storage?.store.getUsedCapacity(RESOURCE_ENERGY) > UpgradeDaemon.Settings.boostEnergyAmount)) ? 2 : 1;

    this.wishList(quantity, setup, options);

  }

  init(): void {


    const outputRate = _.sum(this.agents.map(agent => countValidBodyPart(agent.creep, WORK))) * 2;
    this.resourceFlowStats.pushOutput(RESOURCE_ENERGY, outputRate);

    if (this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.upgradeMinLinkEnergy && (!this.hub.storage || this.hub.storage?.store.getUsedCapacity(RESOURCE_ENERGY) > 5000 || this.hub.controller.ticksToDowngrade < 50000)) {
      // Request energy
      this.hub.linkNetwork.requestInput(this.link);

      if (this.hub.level < 6) {
        // Request energy by hauler if hub level cannot allow full link number
        this.hub.logisticsNetwork.requestInput(this.link, RESOURCE_ENERGY);

        if (this.hub.storage && this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
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

    if (this.upgradeArea.container && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Energy required into container

      if ((!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 5000) && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) > 400) {
        // Request energy into the container
        this.hub.logisticsNetwork.requestInput(this.upgradeArea.container, RESOURCE_ENERGY);
      }

      if (this.hub.level < 8 && this.hub.storage && this.hub.storage.store.getUsedCapacity() > 40000 && this.upgradeArea.container.store.getFreeCapacity(RESOURCE_ENERGY) >= 1000) {
        // Request energy from Storage If no link available
        this.hub.logisticsNetwork.removeRequest(this.hub.storage, RESOURCE_ENERGY);
        this.hub.logisticsNetwork.requestOutput(this.hub.storage, RESOURCE_ENERGY);
      }

    }

    if (this.upgradeArea.container && this.hub.storage) {
      // Vacuum container
      for (const resource in this.upgradeArea.container.store) {
        if (resource != RESOURCE_ENERGY && this.hub.storage.store.getUsedCapacity(resource as ResourceConstant) < Settings.hubStorageMaxResource) {
          this.hub.logisticsNetwork.requestOutput(this.upgradeArea.container, resource as ResourceConstant);
          this.hub.logisticsNetwork.requestInput(this.hub.storage, resource as ResourceConstant);
        }
      }
    }

    if (!this.upgradeArea.container && !this.upgradeArea.link && this.agents.length > 0) {
      // Request energy on ground
      this.hub.logisticsNetwork.requestDrop(this.upgradeArea.dropPos, RESOURCE_ENERGY);
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => UpgradeRole.pipeline(this.hub, agent, this.upgradeArea.container, this.upgradeArea.link));

  }

}