import { Actor } from "Actor";
import { Agent } from "agent/Agent";
import { CPU } from "cpu/CPU";
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW, PROCESS_PRIORITY_NORMAL, pushProcess } from "cpu/process";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import _ from "lodash";
import { log } from "utils/log";

export class TowerDaemon extends Daemon {

  static Settings = {
    minimumEnergyHeal: 400,
    minimumEnergyRepair: 600,        // Minimum require to repair
    maximumRepairHit: 100000
  };

  closestHostile: Creep | null;
  agentInjured?: Agent;
  structureDamaged?: Structure;

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'tower', RunActivity.Always);
    this.closestHostile = null;
  }

  private handleEnergyRequests() {
    for (const tower of this.hub.towers) {
      if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Not enought energy
        this.hub.logisticsNetwork.requestInput(tower, RESOURCE_ENERGY);
      }
    }
  }

  private towerHandler(tower: StructureTower, hostile: Creep | null, agentInjured?: Agent, structureDamaged?: Structure) {

    // Defense
    // const closestHostile = tower.pos.findClosestByRange(this.hub.hostilesCreepsByRooms[tower.pos.roomName] ?? []);

    if (hostile) {
      pushProcess(this.hub.processStack, () => {
        const r = tower.attack(hostile);
        if (r == OK) {
          return;
        } else {
          log.warning(`${this.print} cannot attack hostile ${hostile.name}`)
        }
      }, PROCESS_PRIORITY_HIGHT);
    }

    // heal
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyHeal) {

      if (agentInjured) {

        pushProcess(this.hub.processStack, () => {
          const r = tower.heal(agentInjured.creep);
          if (r == OK) {
            return;
          } else {
            log.warning(`${this.print} cannot heal ${agentInjured.print}`)
          }
        }, PROCESS_PRIORITY_NORMAL);
      }

    }

    // repair
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyRepair) {

      // const damagedStructures = _.filter(this.hub.structuresByRooms[this.pos.roomName] ?? [], structure => structure.hits < structure.hitsMax && structure.hits < TowerDaemon.Settings.maximumRepairHit);

      // const nearest = _.last(_.sortBy(damagedStructures, structure => structure.pos.getRangeTo(tower.pos)));

      if (structureDamaged) {
        pushProcess(this.hub.processStack, () => tower.repair(structureDamaged), PROCESS_PRIORITY_LOW);
      }
    }

  }

  refresh(): void {
    super.refresh();

    /*
    if (this.agentInjured) {
      this.agentInjured = _.find(this.hub.agents, agent => agent.id == this.agentInjured?.id);
    }
    */

    if (this.structureDamaged) {
      this.structureDamaged = _.find(this.hub.structuresByRooms[this.pos.roomName], structure => structure.id == this.structureDamaged?.id);
      if (this.structureDamaged && this.structureDamaged.hits == this.structureDamaged.hitsMax) {
        this.structureDamaged = undefined;
      }
    }

  }

  init(): void {

    if (this.hub.towers.length == 0) {
      // No tower
      return;
    }

    const hostiles = this.hub.hostilesCreepsByRooms[this.pos.roomName] ?? [];

    log.debug(`init Tower hostiles : ${hostiles.length}`)

    // Defense
    if (hostiles.length > 0) {
      this.closestHostile = this.pos.findClosestByRange(hostiles);
    } else {
      this.closestHostile = null;
    }

    /*
    if ((!this.agentInjured && Game.time % 10 == 0) || (this.agentInjured && this.agentInjured.hits == this.agentInjured.hitsMax)) {
      this.agentInjured = _.chain(this.hub.agents)//
        .filter(agent => agent.pos.roomName == this.room.name && agent.hits < agent.hitsMax)//
        .orderBy(agent => agent.hits, ['asc'])//
        .first()//
        .value();
    }
    */


    const damagedStructures = _.filter(this.hub.structuresByRooms[this.pos.roomName] ?? [], structure => structure.hits < structure.hitsMax && structure.hits < TowerDaemon.Settings.maximumRepairHit && !this.hub.roomPlanner.isDismantle(structure));

    this.structureDamaged = damagedStructures[0];


    if (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
      // Request energy if no supplier are present/planned or storage is empty
      this.handleEnergyRequests();
    }

  }

  run(): void {

    this.hub.towers.forEach(tower => this.towerHandler(tower, this.closestHostile, this.agentInjured, this.structureDamaged));

  }

}