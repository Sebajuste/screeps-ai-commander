import { Hub } from "hub/Hub";
import { lookForStructure } from "hub/room-planner/room-planner";
import { CombatIntelligence } from "intelligence/combat";
import _ from "lodash";

export class CombatTargeting {

  static findBestCreepTargetForTowers(hub: Hub, targets = hub.hostilesCreeps): Creep | undefined {
    return _.maxBy(targets, (hostile: any) => {
      if (hostile.hitsPredicted == undefined) hostile.hitsPredicted = hostile.hits;
      if (lookForStructure(hostile.pos, STRUCTURE_RAMPART)) return false;
      return hostile.hitsMax - hostile.hitsPredicted + CombatIntelligence.getHealPotential(hostile) + (CombatIntelligence.towerDamageAtPos(hub.towers, hostile.pos) || 0);
    });
  }

}