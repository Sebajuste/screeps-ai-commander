import { Actor } from "Actor";
import { AgentRequestOptions, AgentSetup } from "agent/Agent";
import { countBodyPart, selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, HAULER_TEMPLATE } from "agent/agent-setup";
import { HaulerRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { HarvestDaemon } from "daemons/resources/harvest-daemon";
import { Directive } from "directives/Directive";
import { EnergySourceDirective } from "directives/resources/energy-source-directive";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { log } from "utils/log";
import { MathRange } from "utils/math";


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

  constructor(hub: Hub, initializer: Actor, priority?: number, maxQuantity: number = 1) {
    super(hub, initializer, 'hauler', RunActivity.LocalHarvest, priority);
    this.initializer = initializer;
    this.maxQuantity = maxQuantity;
    this.memory = Mem.wrap(initializer.memory, 'haulerStat', { eta: 0, inputRate: 0 });

    this._haulerRequireTTL = Game.time;
  }

  private spawnHandler() {

    const bodyParts = selectBodyParts(HAULER_TEMPLATE, this.hub.room.energyAvailable);

    if (!this._haulerRequire || this._haulerRequireTTL <= Game.time || this.pos.roomName == 'sim') {
      const totalResourcesToTransport = _.chain(this.hub.dispatcher.directives)//
        .filter(directive => Directive.isDirective(directive.flag, 'harvest') && !(directive as EnergySourceDirective).link)//
        .map((directive: EnergySourceDirective) => directive.daemons.harvest.inputRate * directive.daemons.harvest.eta * 2.0)//
        .sum()//
        .value();

      log.debug('totalResourcesToTransport : ', totalResourcesToTransport);

      const carryPerAgent = countBodyPart(bodyParts, CARRY) * CARRY_CAPACITY;
      const haulerRequire = Math.ceil(totalResourcesToTransport / carryPerAgent);
      this._haulerRequire = MathRange(1, this.maxQuantity, haulerRequire);

      this._haulerRequireTTL = Game.time + 15;
    }



    // const haulerRequire = (this.hub.sources.length - (this.hub.links.length - 2));

    // const haulerQuantity = MathRange(1, this.maxQuantity, haulerEta / carryPerAgent);





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

    if (this.maxQuantity > 0) {
      this.spawnHandler();
    }

  }

  run(): void {

    this.autoRun(this.agents, agent => HaulerRole.pipeline(this.hub, agent, this.hub.logisticsNetwork.getLogisticsRequest(agent)));

  }

}
