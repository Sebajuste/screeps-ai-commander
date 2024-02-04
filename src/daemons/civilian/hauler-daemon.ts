import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HAULER_TEMPLATE } from "agent/agent-setup";
import { HaulerRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { Directive } from "directives/Directive";
import { EnergySourceDirective } from "directives/resources/energy-source-directive";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { log } from "utils/log";
import { MathRange } from "utils/math";

const HAULER_DAEMON_PRIORITY = 50;


export interface HaulerStat {
  inputRate: number;
  eta: number;
}

export class HaulerDaemon extends Daemon {

  initializer: Actor;

  maxQuantity: number;
  memory: HaulerStat;

  _haulerRequire?: number;
  _haulerRequireTTL: number;

  constructor(hub: Hub, initializer: Actor, maxQuantity: number = 1) {
    super(hub, initializer, 'hauler', RunActivity.LocalHarvest, HAULER_DAEMON_PRIORITY);
    this.initializer = initializer;
    this.maxQuantity = maxQuantity;
    this.memory = Mem.wrap(initializer.memory, 'haulerStat', { eta: 0, inputRate: 0 });

    this._haulerRequireTTL = Game.time;
  }

  get ready(): boolean {
    return this.hub.logisticsNetwork.inputRequest() == 0 || this.hub.logisticsNetwork.outputRequest() == 0 ? false : this.agents.length > 0;
  }

  private spawnHandler() {

    if (this.hub.logisticsNetwork.inputRequest() == 0 || this.hub.logisticsNetwork.outputRequest() == 0) {
      log.warning(`${this.print} No requist to spawn haulers`);
      return;
    }

    const bodyParts = selectBodyParts(HAULER_TEMPLATE, this.hub.room.energyAvailable);

    if (!this._haulerRequire || this._haulerRequireTTL <= Game.time) {
      // Compute number of hauler required

      this.hub.dispatcher.directives.filter(directive => Directive.isDirective(directive.flag, 'harvest')).forEach(directive => {
        if (!directive.daemons.harvest) {
          log.error(`${directive.print} does not have harvest daemon`)
        }
      });

      const totalResourcesToTransport = _.chain(this.hub.dispatcher.directives)//
        .filter(directive => Directive.isDirective(directive.flag, 'harvest') && !(directive as EnergySourceDirective).link && !this.hub.dispatcher.isDaemonSuspended((directive as EnergySourceDirective).daemons.harvest))//
        .map((directive: EnergySourceDirective) => directive.daemons.harvest ? directive.daemons.harvest.inputRate * directive.daemons.harvest.eta * 2.0 : 100.0)//
        .sum()//
        .value();

      log.debug('totalResourcesToTransport : ', totalResourcesToTransport);

      const carryPerAgent = countBodyPart(bodyParts, CARRY) * CARRY_CAPACITY;
      const haulerRequire = Math.ceil(totalResourcesToTransport / carryPerAgent);
      this._haulerRequire = MathRange(1, this.maxQuantity, haulerRequire);

      this._haulerRequireTTL = Game.time + 15;
    }


    const setup: AgentSetup = {
      role: 'hauler',
      bodyParts: bodyParts
    };

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.hauler
    };

    log.debug('Hauler required : ', this._haulerRequire);

    this.wishList(this._haulerRequire, setup, options);

  }

  refresh(): void {
    this.memory = Mem.wrap(this.initializer.memory, 'haulerStat', {});
  }

  init(): void {

    if (!this.reachable) {
      log.warning(`${this.print} room not reachable`)
    }

    this.spawnHandler();

  }

  run(): void {

    if (!this.ready) {
      // No logistic request or hauler ready
      return;
    }

    this.autoRun(this.agents, agent => HaulerRole.pipeline(this.hub, agent, this.hub.logisticsNetwork.getLogisticsRequest(agent)));

  }

}
