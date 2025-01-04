import { boostResources } from "data/resource";
import _ from "lodash";

/**
 * A utility class that provides intelligence and calculations related to combat situations in the game.
 */
export class CombatIntelligence {

  private static cache(creep: any, key: string, callback: () => number): number {
    if (!creep.intel) creep.intel = {};
    if (creep.intel[key] == undefined) {
      creep.intel[key] = callback();
    }
    return creep.intel[key];
  }

  static getHealAmount(creep: Creep): number {
    return HEAL_POWER * this.getHealPotential(creep);
  }

  static getRangedHealAmount(creep: Creep): number {
    return RANGED_HEAL_POWER * this.getHealPotential(creep);
  }

  /**
   * Calculates and caches the maximum amount of healing that hostile creeps can provide to each other within range of the given creep.
   * This includes self-healing, healing from adjacent hostile creeps, and ranged healing from hostile creeps up to 3 squares away.
   *
   * @param {Creep} creep - The creep for which to calculate maximum healing from hostiles.
   * @param {Creep[]} hostiles - An array of all hostile creeps in the room.
   * @returns {number} - The maximum amount of healing that can be provided to the given creep by hostiles within range.
   */
  static maxHostileHealingTo(creep: Creep, hostiles: Creep[]): number {
    return this.cache(creep, 'maxHostileHealing', () => {
      const selfHealing = CombatIntelligence.getHealAmount(creep);
      const neighbors = _.filter(hostiles, hostile => hostile.pos.isNearTo(creep));
      const neighborHealing = _.sumBy(neighbors, neighbor => CombatIntelligence.getHealAmount(neighbor));
      const rangedHealers = _.filter(hostiles, hostile => hostile.pos.getRangeTo(creep) <= 3 &&
        !neighbors.includes(hostile));
      const rangedHealing = _.sumBy(rangedHealers, healer => this.getRangedHealAmount(healer));
      return selfHealing + neighborHealing + rangedHealing;
    });
  }

/**
 * Calculates the average maximum amount of healing that hostile creeps can provide to each other within range of the given creep,
 * considering all provided creeps and a separate array of hostiles. The result is the maximum healing divided by the number of creeps.
 *
 * @param {Creep[]} creeps - An array of creeps for which to calculate the average maximum healing from hostiles.
 * @param {Creep[]} [hostiles=creeps] - A separate array of hostile creeps in the room. If not provided, it defaults to the same as 'creeps'.
 * @returns {number} - The average maximum amount of healing that can be provided to the given creeps by hostiles within range.
 */
  static avgHostileHealingTo(creeps: Creep[], hostiles: Creep[] = creeps): number {
    return _.chain(creeps)//
      .map(creep => CombatIntelligence.maxHostileHealingTo(creep, hostiles))//
      .max()//
      .value() / creeps.length;
  }

  static getHealPotential(creep: Creep) {
    return this.cache(creep, 'healPotential', () => {

      return _.chain(creep.body)//
        .map(part => {
          if (part.hits == 0) {
            return 0;
          }
          if (part.type == HEAL) {
            if (!part.boost) {
              return 1;
            } else if (part.boost == boostResources.heal[1]) {
              return BOOSTS.heal.LO.heal;
            } else if (part.boost == boostResources.heal[2]) {
              return BOOSTS.heal.LHO2.heal;
            } else if (part.boost == boostResources.heal[3]) {
              return BOOSTS.heal.XLHO2.heal;
            }
          }
          return 0;
        })//
        .sum()//
        .value();

    });

  }


  static singleTowerDamage(range: number): number {
    if (range <= TOWER_OPTIMAL_RANGE) {
      return TOWER_POWER_ATTACK;
    }
    range = Math.min(range, TOWER_FALLOFF_RANGE);
    const falloff = (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
    return TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF * falloff);
  }


  static towerDamageAtPos(towers: StructureTower[], pos: RoomPosition, ignoreEnergy = false) {

    let expectedDamage = 0;
    for (const tower of towers) {
      if (ignoreEnergy || tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        expectedDamage += this.singleTowerDamage(pos.getRangeTo(tower));
      }
    }
    return expectedDamage;

  }

  static minimumDamageTakenMultiplier(creep: Creep): number {
    return this.cache(creep, 'minDamageMultiplier', () =>

      _.chain(creep.body)//
        .map(part => {
          if (part.type == TOUGH && part.hits > 0) {
            if (part.boost == boostResources.tough[1]) {
              return BOOSTS.tough.GO.damage;
            } else if (part.boost == boostResources.tough[2]) {
              return BOOSTS.tough.GHO2.damage;
            } else if (part.boost == boostResources.tough[3]) {
              return BOOSTS.tough.XGHO2.damage;
            }
          }
          return 1;
        })//
        .min()//
        .value()
      /*
        _.min(_.map(creep.body, function (part) {
          if (part.type == TOUGH && part.hits > 0) {
            if (part.boost == boostResources.tough[1]) {
              return BOOSTS.tough.GO.damage;
            } else if (part.boost == boostResources.tough[2]) {
              return BOOSTS.tough.GHO2.damage;
            } else if (part.boost == boostResources.tough[3]) {
              return BOOSTS.tough.XGHO2.damage;
            }
          }
          return 1;
        }))
        */
    );
  }

}