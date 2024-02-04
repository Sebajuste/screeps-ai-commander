import { PROCESS_PRIORITY_HIGHT, pushProcess } from "cpu/process";
import { Daemon } from "daemons/daemon";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import _, { Dictionary } from "lodash";
import { Mem } from "memory/Memory";
import { log } from "utils/log";

export interface DispatcherMemory {
  suspendUntil: { [ref: string]: number };
}

const DEFAULT_MEMORY: DispatcherMemory = {
  suspendUntil: {}
};

export class Dispatcher {

  static Settings = {
    areaPriotityOffset: 1,
    directivePriotityOffset: 2,
    daemonPriotityOffset: 3,
  };

  hub: Hub;
  daemons: Daemon[];
  daemonsByActivity: Dictionary<Daemon[]>;
  _runableDaemons?: Daemon[];
  directives: Directive[];
  memory: DispatcherMemory;

  constructor(hub: Hub) {
    this.hub = hub;
    this.daemons = [];
    this.daemonsByActivity = {};
    this.directives = [];

    this.memory = Mem.wrap(hub.memory, 'dispatcher', DEFAULT_MEMORY);
  }

  get runableSortedDaemons(): Daemon[] {

    if (!this._runableDaemons) {
      this._runableDaemons = _.orderBy(_.filter(this.daemons, daemon => !this.isDaemonSuspended(daemon)), daemon => daemon.priority);
    }
    return this._runableDaemons;

  }

  suspendDaemon(daemon: Daemon, ticks: number) {
    this.memory.suspendUntil[daemon.ref] = Game.time + ticks;
    if (!this.isDaemonSuspended(daemon)) {
      log.info(`${this.hub.print} Suspend daemon ${daemon.name} for ${ticks} ticks`)
    }
  }

  activeDaemon(daemon: Daemon) {
    delete this.memory.suspendUntil[daemon.ref];
    log.info(`${this.hub.print} daemon ${daemon.name} activated`);
  }

  isDaemonSuspended(daemon: Daemon) {
    if (daemon && this.memory.suspendUntil[daemon.ref]) {
      if (Game.time > this.memory.suspendUntil[daemon.ref]) {
        this.activeDaemon(daemon);
        return false;
      }
      return true;
    }
    return false;
  }

  findActiveDaemonByName(name: string): Daemon | undefined {
    return _.find(this.daemons, daemon => daemon.name === name && !this.isDaemonSuspended(daemon));
  }

  registerDaemon(daemon: Daemon) {

    if (_.find(this.daemons, it => it.ref == daemon.ref) != undefined) {
      // Already registered
      return;
    }

    this.daemons.push(daemon);
    this.daemons = _.orderBy(this.daemons, ['priority']);

    if (!this.daemonsByActivity[daemon.activity]) {
      this.daemonsByActivity[daemon.activity] = [];
    }
    this.daemonsByActivity[daemon.activity].push(daemon);

    log.debug(`${this.hub.name} register daemon ${daemon.name}`);
  }

  removeDaemon(daemon: Daemon) {
    _.remove(this.daemons, sys => sys.ref == daemon.ref);
    if (this.daemonsByActivity[daemon.activity]) {
      _.remove(this.daemonsByActivity[daemon.activity], sys => sys.ref == daemon.ref);
    }
    log.debug(`${this.hub.name} remove daemon ${daemon.name}`);
  }

  registerDirective(directive: Directive) {
    log.debug(`${this.hub.print} register Directive ${directive.name}`);
    this.directives.push(directive);
  }

  removeDirective(directive: Directive) {
    log.debug(`${this.hub.print} remove Directive ${directive.name}`);
    _.remove(this.directives, d => d.ref == directive.ref);
  }

  getAgentReport(): string[][] {
    const spoopyBugFix = false;
    const roleOccupancy: { [role: string]: [number, number] } = {};

    for (const daemon of this.daemons) {
      for (const role in daemon.agentUsageReport) {
        const report = daemon.agentUsageReport[role];
        if (report == undefined) {
          if (Game.time % 100 == 0) {
            log.info(`Role ${role} is not reported by ${daemon.ref}!`);
          }
        } else {
          if (roleOccupancy[role] == undefined) {
            roleOccupancy[role] = [0, 0];
          }
          roleOccupancy[role][0] += report[0];
          roleOccupancy[role][1] += report[1];
          if (spoopyBugFix) { // bizzarely, if you comment these lines out, the creep report is incorrect
            log.debug(`report: ${JSON.stringify(report)}`);
            log.debug(`occupancy: ${JSON.stringify(roleOccupancy)}`);
          }
        }
      }
    }

    // let padLength = _.max(_.map(_.keys(roleOccupancy), str => str.length)) + 2;
    const roledata: string[][] = [];

    const roles = _.uniq([..._.keys(this.hub.agentsByRole), ..._.keys(roleOccupancy)])

    for (const role of roles) {
      const [current, needed] = roleOccupancy[role] ?? [(this.hub.agentsByRole[role] ?? []).length, '???'];
      roledata.push([role, `${current}/${needed}`]);
    }

    /*
    for (const role in roleOccupancy) {
      const [current, needed] = roleOccupancy[role];
      // if (needed > 0) {
      // 	stringReport.push('| ' + `${role}:`.padRight(padLength) +
      // 					  `${Math.floor(100 * current / needed)}%`.padLeft(4));
      // }
      roledata.push([role, `${current}/${needed}`]);
    }
    */
    return roledata;
  }

  getDirectiveReport(): { data: string[][], styles: TextStyle[] } {
    const styles: TextStyle[] = [];

    const roledata: string[][] = _.chain(this.directives)//
      .orderBy(area => Math.max(area.performanceReport['init'] ?? 0, area.performanceReport['run'] ?? 0), ['desc'])//
      .map(area => [`${area.name}@${area.pos.roomName}`, `${area.performanceReport['init'] ?? '---'} ${area.performanceReport['run'] ?? '---'}`])//
      .value();

    const total = _.reduce(this.directives, (acc, area) => [acc[0] + (area.performanceReport['init'] ?? 0), acc[1] + (area.performanceReport['run'] ?? 0)], [0, 0]);

    roledata.push(['TOTAL', `${Math.round(total[0] * 100 + Number.EPSILON) / 100} + ${Math.round(total[1] * 100 + Number.EPSILON) / 100} = ${Math.round((total[0] + total[1]) * 100 + Number.EPSILON) / 100}`]);
    return { data: roledata, styles: styles };
  }

  getDaemonReport(): { data: string[][], styles: TextStyle[] } {

    // const roledata: string[][] = [];
    const styles: TextStyle[] = [];

    const roledata: string[][] = _.chain(this.daemons)//
      .orderBy(daemon => Math.max(daemon.performanceReport['init'] ?? 0, daemon.performanceReport['run'] ?? 0), ['desc'])//
      .map(daemon => [`${daemon.name}@${daemon.pos.roomName}`, `  ${daemon.agents.length} - ${daemon.performanceReport['init'] ?? '---'} ${daemon.performanceReport['run'] ?? '---'}`])//
      .value();

    const total = _.reduce(this.daemons, (acc, daemon) => [acc[0] + (daemon.performanceReport['init'] ?? 0), acc[1] + (daemon.performanceReport['run'] ?? 0)], [0, 0]);

    roledata.push(['TOTAL', `${Math.round(total[0] * 100 + Number.EPSILON) / 100} + ${Math.round(total[1] * 100 + Number.EPSILON) / 100} = ${Math.round((total[0] + total[1]) * 100 + Number.EPSILON) / 100}`]);

    /*
  for (const daemon of this.daemons) {
    roledata.push([`${daemon.name}@${daemon.pos.roomName}`, `  ${daemon.agents.length} - ${daemon.performanceReport['init'] ?? '---'} ${daemon.performanceReport['run'] ?? '---'}`]);
    styles.push({});
  }
  */

    return { data: roledata, styles: styles };
  }

  refresh() {
    this._runableDaemons = undefined;
    this.directives.forEach(directive => pushProcess(this.hub.processStack, () => directive.refresh(), PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.directivePriotityOffset));
    this.daemons.forEach(daemon => pushProcess(this.hub.processStack, () => daemon.refresh(), PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.daemonPriotityOffset));
  }

  init() {
    this.directives.forEach(directive => pushProcess(this.hub.processStack, () => {
      const start = Game.cpu.getUsed();
      directive.init();
      const cpuCost = Game.cpu.getUsed() - start;
      directive.performanceReport['init'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.directivePriotityOffset + 10));

    this.runableSortedDaemons.forEach(daemon => pushProcess(this.hub.processStack, () => {
      const start = Game.cpu.getUsed();
      daemon.preInit();
      daemon.init();
      const cpuCost = Game.cpu.getUsed() - start;
      daemon.performanceReport['init'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.daemonPriotityOffset + 10));
  }

  run() {
    this.directives.forEach(directive => pushProcess(this.hub.processStack, () => {
      const start = Game.cpu.getUsed();
      directive.run();
      const cpuCost = Game.cpu.getUsed() - start;
      directive.performanceReport['run'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.directivePriotityOffset + 20));

    this.runableSortedDaemons.forEach(daemon => pushProcess(this.hub.processStack, () => {
      const start = Game.cpu.getUsed();
      daemon.run();
      const cpuCost = Game.cpu.getUsed() - start;
      daemon.performanceReport['run'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.daemonPriotityOffset + 20));
  }

}
