import { Actor } from "Actor";
import { Agent } from "agent/Agent";
import { countValidBodyPart, haveBodyPart } from "agent/agent-builder";
import { CPU } from "cpu/CPU";
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW, PROCESS_PRIORITY_NORMAL, pushProcess } from "cpu/process";
import { DAEMON_BUILD_NAME, Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { CombatIntelligence } from "intelligence/combat";
import _ from "lodash";
import { log } from "utils/log";
import { CombatTargeting } from "utils/targeting";

export class TowerDaemon extends Daemon {

  static Settings = {
    minimumEnergyHeal: 400,
    minimumEnergyRepair: 600,        // Minimum require to repair
    maximumRepairHit: 100000
  };

  closestHostile?: Creep;
  agentInjured?: Agent;
  structureDamaged?: Structure;

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'tower', RunActivity.Always);
  }

  private handleEnergyRequests() {
    for (const tower of this.hub.towers) {
      if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * 0.1) {
        // Not enought energy
        this.hub.logisticsNetwork.requestInput(tower, RESOURCE_ENERGY);
      }
    }
  }

  private attack(target: Creep) {

    for (const tower of this.hub.towers) {

      pushProcess(this.hub.processStack, () => tower.attack(target), PROCESS_PRIORITY_HIGHT);

    }

  }

  private repairNearestStructure() {
    var closestDamagedStructure = this.pos.findClosestByRange(this.hub.structuresByRooms[this.pos.roomName] ?? [], {
      filter: (s: Structure) => s.hits < s.hitsMax &&
        s.structureType != STRUCTURE_WALL &&
        s.structureType != STRUCTURE_RAMPART
    });
    if (closestDamagedStructure) {
      for (const tower of this.hub.towers) {
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyRepair && (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > (this.room.energyCapacityAvailable / 2))) {
          // tower.repair(closestDamagedStructure);
          pushProcess(this.hub.processStack, () => tower.repair(closestDamagedStructure!), PROCESS_PRIORITY_LOW);
        }
      }
    }
  }

  private heal(ally: Creep) {
    for (const tower of this.hub.towers) {
      if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyHeal) {
        pushProcess(this.hub.processStack, () => tower.heal(ally), PROCESS_PRIORITY_NORMAL);
      }
    }
  }

  private towerHandler(tower: StructureTower, hostile?: Creep, agentInjured?: Agent, structureDamaged?: Structure) {

    // Defense

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
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyRepair && (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > (this.room.energyCapacityAvailable / 2))) {

      if (structureDamaged) {
        pushProcess(this.hub.processStack, () => tower.repair(structureDamaged), PROCESS_PRIORITY_LOW);
      }
    }

  }

  refresh(): void {
    super.refresh();

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

    if (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
      // Request energy if no supplier are present/planned or storage is empty
      this.handleEnergyRequests();
    }

  }

  run(): void {

    const hostiles = this.hub.hostilesCreepsByRooms[this.pos.roomName] ?? [];

    if (hostiles.length > 0) {
      // Attack


      /*
      const avgHealing = CombatIntelligence.avgHostileHealingTo(hostiles);
      const possibleTargets = _.chain(hostiles)//
        .filter(hostile => {
          const damageTaken = CombatIntelligence.towerDamageAtPos(this.hub.towers, hostile.pos)!;
          const damageMultiplier = CombatIntelligence.minimumDamageTakenMultiplier(hostile);
          return damageTaken * damageMultiplier > avgHealing;
        })//
        .value();
      */
      const target = CombatTargeting.findBestCreepTargetForTowers(this.hub, hostiles);

      if (target) {
        return this.attack(target);
      }

    }

    const closestDamagedAlly = this.pos.findClosestByRange(_.filter(this.hub.agentByRoom[this.pos.roomName] ?? [], creep => creep.hits < creep.hitsMax));
    if (closestDamagedAlly) {
      // Heal
      this.heal(closestDamagedAlly.creep);
      return;
    }

    if (this.hub.dispatcher.findActiveDaemonByName(DAEMON_BUILD_NAME) != undefined) {
      // Tower will repair only if repairer are not available
      this.repairNearestStructure();
    }
  }

}

function hostileScore(pos: RoomPosition, hostile: Creep) {

  const distanceScore = 1.0 / pos.getRangeTo(hostile);
  const typeScore = countValidBodyPart(hostile, HEAL) > 0 ? 10 : 1;
  return typeScore * distanceScore;
}
