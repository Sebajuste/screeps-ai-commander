import { Actor } from "Actor";
import { Agent } from "agent/Agent";
import { countValidBodyPart, haveBodyPart } from "agent/agent-builder";
import { CPU } from "cpu/CPU";
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW, PROCESS_PRIORITY_NORMAL, pushProcess } from "cpu/process";
import { Daemon } from "daemons";
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
      if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Not enought energy
        this.hub.logisticsNetwork.requestInput(tower, RESOURCE_ENERGY);
      }
    }
  }

  private attack(target: Creep) {

    for (const tower of this.hub.towers) {

      pushProcess(this.hub.processStack, () => tower.attack(target), PROCESS_PRIORITY_HIGHT);

      /*
      const result = tower.attack(target);
      if (result == OK) {
        if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
        target.hitsPredicted -= CombatIntel.singleTowerDamage(target.pos.getRangeTo(tower));
      }
      */
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
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyRepair)
          // tower.repair(closestDamagedStructure);
          pushProcess(this.hub.processStack, () => tower.repair(closestDamagedStructure!), PROCESS_PRIORITY_LOW);
      }
    }
  }

  private heal(ally: Creep) {
    for (const tower of this.hub.towers) {
      // tower.heal(ally);
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

    /*
    const hostiles = this.hub.hostilesCreepsByRooms[this.pos.roomName] ?? [];

    // Defense
    if (hostiles.length > 0) {
      // this.closestHostile = this.pos.findClosestByRange(hostiles);
      this.closestHostile = _.first(_.orderBy(hostiles, hostile => hostileScore(this.pos, hostile), ['desc']));
    } else {
      this.closestHostile = undefined;
    }


    const damagedStructures = _.filter(this.hub.structuresByRooms[this.pos.roomName] ?? [], structure => structure.hits < structure.hitsMax && structure.hits < TowerDaemon.Settings.maximumRepairHit && !this.hub.roomPlanner.isDismantle(structure));
    this.structureDamaged = damagedStructures[0];
    */

    if (!this.hub.storage || this.hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
      // Request energy if no supplier are present/planned or storage is empty
      this.handleEnergyRequests();
    }

  }

  run(): void {

    const hostiles = this.hub.hostilesCreepsByRooms[this.pos.roomName] ?? [];
    if (hostiles.length > 0) {

      const avgHealing = CombatIntelligence.avgHostileHealingTo(hostiles);

      const possibleTargets = _.chain(hostiles)//
        .filter(hostile => {
          const damageTaken = CombatIntelligence.towerDamageAtPos(this.hub.towers, hostile.pos)!;
          const damageMultiplier = CombatIntelligence.minimumDamageTakenMultiplier(hostile);
          return damageTaken * damageMultiplier > avgHealing;
        })//
        /*
        .filter(hostile => {
          if (CombatIntel.isEdgeDancing(hostile)) {
            const netDPS = CombatIntel.towerDamageAtPos(hostile.pos)! + myCreepDamage - (HEAL_FUDGE_FACTOR * CombatIntel.maxHostileHealingTo(hostile));
            const isKillable = netDPS * hostile.pos.rangeToEdge > hostile.hits;
            if (isKillable) {
              return true;
            } else {
              // Shoot if they get close enough
              if (hostile.pos.getRangeTo(this.hub.pos) <= 6 + 2) {
                return true;
              }
            }
          } else {
            return true;
          }
        })//
        */
        .value();

      const target = CombatTargeting.findBestCreepTargetForTowers(this.hub, possibleTargets);

      if (target) {
        return this.attack(target);
      }

    }


    const closestDamagedAlly = this.pos.findClosestByRange(_.filter(this.hub.agentByRoom[this.pos.roomName] ?? [], creep => creep.hits < creep.hitsMax));
    if (closestDamagedAlly) {
      this.heal(closestDamagedAlly.creep);
      return;
    }

    // this.hub.towers.forEach(tower => this.towerHandler(tower, this.closestHostile, this.agentInjured, this.structureDamaged));

    this.repairNearestStructure();
  }

}

function hostileScore(pos: RoomPosition, hostile: Creep) {

  const distanceScore = 1.0 / pos.getRangeTo(hostile);
  const typeScore = countValidBodyPart(hostile, HEAL) > 0 ? 10 : 1;
  return typeScore * distanceScore;
}
