import _ from "lodash";

export type BodyParts = BodyPartConstant[];

export interface BodyTemplate {
  bodyParts: BodyParts[]
};

export function bodyCost(bodyParts: BodyParts) {
  return bodyParts.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

export function selectBodyParts(template: BodyTemplate, energyAvailable: number): BodyParts {
  const bodyParts = template.bodyParts.filter(bodyParts => bodyCost(bodyParts) <= energyAvailable)//
    .sort((a, b) => bodyCost(b) - bodyCost(a))//
    .shift();
  return bodyParts ? bodyParts : template.bodyParts[0];
}

export function countBodyPart(bodyParts: BodyParts, bodyPart: BodyPartConstant): number {
  return bodyParts.filter(it => it == bodyPart).length;
}

export function countValidBodyPart(creep: Creep, bodyPart: BodyPartConstant) {
  let count = 0;
  for (const it of creep.body) {
    if (it.hits > 0 && it.type == bodyPart) {
      count++;
    }
  }
  return count;
}

export function haveBodyPart(creep: Creep, bodyPart: string) {
  for (const index in creep.body) {
    const item = creep.body[index];
    if (item.type === bodyPart && item.hits > 0) {
      return true;
    }
  }
  return false;
}

export function carryCapacity(bodyParts: BodyParts) {
  return _.sum(bodyParts.filter(bodyPart => bodyPart == CARRY).map(bodyPart => CARRY_CAPACITY));
}

/*
export interface CreepSetup {
  role: string;
  body_parts: BodyPartConstant[]
}
*/
