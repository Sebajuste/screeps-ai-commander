import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, UPGRADER_BATTERY_TEMPLATE, UPGRADER_TEMPLATE } from "agent/agent-setup";
import { UpgradeRole } from "agent/roles/roles";
import { UpgradeArea } from "area/hub/upgrade-area";
import { Daemon } from "daemons/daemon";
import { Hub } from "hub/Hub";

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
    const quantity = this.upgradeArea.container ? 1 : 2;

    const bodyParts = selectBodyParts(template, this.hub.room.energyAvailable);

    const setup: AgentSetup = {
      role: 'upgrader',
      bodyParts: bodyParts
    };

    this.wishList(quantity, setup, options);

  }

  init(): void {
    this.spawnHandler();

    if (this.upgradeArea.container) {
      // Request energy into the container
      this.hub.logisticsNetwork.requestInput(this.upgradeArea.container, RESOURCE_ENERGY);
    } else if (this.agents.length > 0) {
      // Request energy on ground
      this.hub.logisticsNetwork.requestDrop(this.upgradeArea.dropPos, RESOURCE_ENERGY);
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => UpgradeRole.pipeline(this.hub, agent, this.upgradeArea.container));

  }

}