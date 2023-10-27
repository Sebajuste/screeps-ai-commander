import { Commander } from "./Commander";
import { CPU } from "cpu/CPU";
import { Mem } from "memory/Memory";
import { Settings } from "settings";
import { log } from "utils/log";

import profiler from './libs/profiler/screeps-profiler';
import { Hub } from "hub/Hub";
import { Directive } from "directives/Directive";
import { Area } from "area/Area";
import { Task } from "task/Task";
import { GaleShapley } from "utils/gale-shapley";
import { TaskPipelineHandler } from "task/task-pipeline";
import { LogisticsNetwork } from "logistics/logistics-network";
import { Exploration } from "Exploration";
import { ProbeDirective } from "directives/expend/probe-directive";
import { BuildDirective } from "directives/hub/build-directive";
import { OutpostDirective } from "directives/hub/outpost-directive";
import { EnergySourceDirective } from "directives/resources/energy-source-directive";
import { Dispatcher } from "hub/dispatcher";
import { Traveler } from "libs/traveler/traveler";
import { BuilderRole, HarvestRole, HaulerRole, ScoutRole, UpgradeRole } from "agent/roles/roles";
import { BuildTask } from "task/tasks/BuildTask";
import { DropTask } from "task/tasks/DropTask";
import { HarvestTask } from "task/tasks/HarvestTask";
import { PickupTask } from "task/tasks/PickupTask";
import { TransferTask } from "task/tasks/TransferTask";
import { UpgradeTask } from "task/tasks/UpgradeTask";
import { WaitTask } from "task/tasks/WaitTask";
import { WithdrawTask } from "task/tasks/WithdrawTask";
import { Agent } from "agent/Agent";
import { deserializeTasks, serializeTasks } from "task/task-initializer";
import { BuildDaemon, Daemon, HarvestDaemon, HaulerDaemon, ProbeDaemon, UpgradeDaemon } from "daemons";


let commander: any = null;

function cleanMemory() {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  }
  for (const name in Memory.flags) {
    if (!Game.flags[name]) {
      delete Memory.flags[name];
    }
  }
}

function registerProfiler() {
  profiler.registerClass(Commander, 'Commander');
  profiler.registerClass(Hub, 'Hub');
  profiler.registerClass(Dispatcher, 'Scheduler');
  profiler.registerClass(LogisticsNetwork, 'LogisticsNetwork');
  profiler.registerClass(Mem, 'Mem');
  profiler.registerClass(Agent, 'Agent');
  profiler.registerClass(Directive, 'Directive');
  profiler.registerClass(Area, 'Area');
  profiler.registerClass(Daemon, 'Daemon');
  profiler.registerClass(Task, 'Task');
  profiler.registerClass(TaskPipelineHandler, 'TaskPipelineHandler');
  profiler.registerClass(Exploration, 'Exploration');
  profiler.registerClass(GaleShapley, 'GaleShapley');
  profiler.registerClass(CPU, 'CPU');
  profiler.registerClass(Traveler, 'Traveler');

  profiler.registerClass(ProbeDirective, 'ScoutDirective');
  profiler.registerClass(BuildDirective, 'BuildDirective');
  profiler.registerClass(OutpostDirective, 'OutpostDirective');
  profiler.registerClass(EnergySourceDirective, 'EnergySourceDirective');

  profiler.registerClass(BuildDaemon, 'BuildDaemon');
  profiler.registerClass(HarvestDaemon, 'HarvestDaemon');
  profiler.registerClass(HaulerDaemon, 'HaulerDaemon');
  profiler.registerClass(UpgradeDaemon, 'UpgradeDaemon');
  profiler.registerClass(ProbeDaemon, 'ScoutDaemon');

  profiler.registerClass(BuilderRole, 'BuilderRole');
  profiler.registerClass(HarvestRole, 'HarvestRole');
  profiler.registerClass(HaulerRole, 'HaulerRole');
  profiler.registerClass(ScoutRole, 'ScoutRole');
  profiler.registerClass(UpgradeRole, 'UpgradeRole');

  profiler.registerClass(BuildTask, 'BuildTask');
  profiler.registerClass(DropTask, 'DropTask');
  profiler.registerClass(HarvestTask, 'HarvestTask');
  profiler.registerClass(PickupTask, 'PickupTask');
  profiler.registerClass(TransferTask, 'TransferTask');
  profiler.registerClass(UpgradeTask, 'UpgradeTask');
  profiler.registerClass(WaitTask, 'WaitTask');
  profiler.registerClass(WithdrawTask, 'WithdrawTask');

  profiler.registerFN(deserializeTasks, 'deserializeTasks');
  profiler.registerFN(serializeTasks, 'serializeTasks');

}

function main() {
  cleanMemory();

  const start = Date.now();

  if (!CPU.shouldRun()) return;

  if (commander == null || Game.time % Settings.rebuildTick == 0) {
    log.info('REBUILD');
    commander = new Commander();
    commander.build();
  } else {
    commander.refresh();
  }

  commander.init();
  commander.run();
  commander.visuals();

  CPU.cpu().run();

  const elapsedTime = Date.now() - start;

  log.info(`[${Game.time}] Loop in ${elapsedTime} ms stats: ${Game.cpu.getUsed()}, total creeps: ${Object.keys(Game.creeps).length}, creep CPU: ${Game.cpu.getUsed() / Math.max(Object.keys(Game.creeps).length, 1)}`);

}

function mainWithProfiler() {
  if (!profiler.isEnabled()) {
    profiler.enable();
    registerProfiler();
  }

  profiler.wrap(() => {
    try {
      main();
    } catch (err: any) {
      log.fatal('Crash : ', err, err.stack);
    }
  });
}


export const loop = () => {

  if (Settings.profilerEnable) {
    mainWithProfiler();
  } else {
    try {
      main();
    } catch (err: any) {
      log.fatal(err);
      log.fatal(err.stack);
    }
  }

};