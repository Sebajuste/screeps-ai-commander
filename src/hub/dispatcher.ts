import { dir } from "console";
import { CPU } from "cpu/CPU";
import { PROCESS_PRIORITY_HIGHT } from "cpu/process";
import { Daemon } from "daemons/daemon";
import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { log } from "utils/log";


export class Dispatcher {

  static Settings = {
    areaPriotityOffset: 1,
    directivePriotityOffset: 2,
    daemonPriotityOffset: 3,
  };

  hub: Hub;
  daemons: Daemon[];
  directives: Directive[];

  constructor(hub: Hub) {
    this.hub = hub;
    this.daemons = [];
    this.directives = [];
  }

  registerDaemon(daemon: Daemon) {

    if (_.find(this.daemons, it => it.ref == daemon.ref) != undefined) {
      // Already registered
      return;
    }

    this.daemons.push(daemon);
    this.daemons = _.orderBy(this.daemons, ['priority']);
    log.debug(`${this.hub.name} register daemon ${daemon.name}`);
  }

  removeDaemon(daemon: Daemon) {
    _.remove(this.daemons, sys => sys.ref == daemon.ref);
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
    this.directives.forEach(directive => CPU.pushProcess(() => directive.refresh(), PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.directivePriotityOffset));
    this.daemons.forEach(daemon => CPU.pushProcess(() => daemon.refresh(), PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.daemonPriotityOffset));
  }

  init() {
    this.directives.forEach(directive => CPU.pushProcess(() => directive.init(), PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.directivePriotityOffset + 10));
    this.daemons.forEach(daemon => CPU.pushProcess(() => {
      const start = Game.cpu.getUsed();
      daemon.preInit();
      daemon.init();
      const cpuCost = Game.cpu.getUsed() - start;
      daemon.performanceReport['init'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.daemonPriotityOffset + 10));
  }

  run() {
    this.directives.forEach(directive => CPU.pushProcess(() => directive.run(), PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.directivePriotityOffset + 20));
    this.daemons.forEach(daemon => CPU.pushProcess(() => {
      const start = Game.cpu.getUsed();
      daemon.run();
      const cpuCost = Game.cpu.getUsed() - start;
      daemon.performanceReport['run'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.daemonPriotityOffset + 20));
  }

}
