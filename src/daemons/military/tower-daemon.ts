import { Actor } from "Actor";
import { Daemon } from "daemons";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { log } from "utils/log";

export class TowerDaemon extends Daemon {

  static Settings = {
    minimumEnergyHeal: 400,
    minimumEnergyRepair: 600,        // Minimum require to repair
    maximumRepairHit: 100000
  };

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'tower')
  }

  private handleEnergyRequests() {
    for (const tower of this.hub.towers) {
      if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Not enought energy
        this.hub.logisticsNetwork.requestInput(tower, RESOURCE_ENERGY);
      }
    }
  }

  private towerHandler(tower: StructureTower) {

    // Defense
    const closestHostile = tower.pos.findClosestByRange(this.hub.hostilesCreepsByRooms[tower.pos.roomName] ?? []);

    if (closestHostile) {
      const r = tower.attack(closestHostile);
      if (r == OK) {
        return;
      } else {
        log.warning(`${this.print} cannot attack hostile ${closestHostile.name}`)
      }
    }

    // heal
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyHeal) {

      const agent = _.chain(this.hub.agents)//
        .filter(pawn => pawn.pos.roomName == this.room.name && pawn.creep.hits < pawn.creep.hitsMax)//
        .orderBy(pawn => pawn.creep.hits, ['asc'])//
        .first()//
        .value();

      if (agent) {
        const r = tower.heal(agent.creep);
        if (r == OK) {
          return;
        } else {
          log.warning(`${this.print} cannot heal ${agent.print}`)
        }
      }

    }

    // repair
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > TowerDaemon.Settings.minimumEnergyRepair) {

      const damagedStructures = _.filter(this.hub.structuresByRooms[this.pos.roomName] ?? [], structure => structure.hits < structure.hitsMax && structure.hits < TowerDaemon.Settings.maximumRepairHit);

      const nearest = _.last(_.sortBy(damagedStructures, structure => structure.pos.getRangeTo(tower.pos)));

      if (nearest) {
        tower.repair(nearest);
      }
    }

  }

  init(): void {

    if (!this.hub.storage) {
      // Request energy if no supplier are present/planned
      this.handleEnergyRequests();
    }

  }

  run(): void {

    this.hub.towers.forEach(tower => this.towerHandler(tower));

  }

}