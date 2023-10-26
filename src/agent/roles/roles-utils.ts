import { Exploration } from "Exploration";
import { Agent } from "agent/Agent";
import { haveBodyPart } from "agent/agent-builder";
import { StoreStructure } from "task/task-builder";
import { getMultiRoomRange, getRoomRange } from "utils/util-pos";

const STRUCTURE_WEIGHT: { [key: string]: number } = {
  [STRUCTURE_SPAWN]: 100,
  [STRUCTURE_TOWER]: 80,
  [STRUCTURE_STORAGE]: 70,
  [STRUCTURE_LINK]: 35,
  [STRUCTURE_CONTAINER]: 30,
  [STRUCTURE_EXTENSION]: 20,
  [STRUCTURE_ROAD]: 2
};

function getBuildWeigth(construction_site: ConstructionSite) {
  const weight = STRUCTURE_WEIGHT.hasOwnProperty(construction_site.structureType) ? STRUCTURE_WEIGHT[construction_site.structureType] : 1.0;
  if (construction_site.structureType == STRUCTURE_ROAD) {
    const terrain_type = construction_site.room?.getTerrain().get(construction_site.pos.x, construction_site.pos.y)
    return terrain_type == TERRAIN_MASK_SWAMP ? weight * 4 : weight;
  }
  return weight;
}


function getSupplyWeigth(site: Structure) {
  if (site.structureType == STRUCTURE_SPAWN) return 10;
  if (site.structureType == STRUCTURE_LAB) return 5;
  return 1;
}

export function dropScore(from: { pos: RoomPosition, store: StoreDefinition }, resource: Resource<ResourceConstant>) {
  const range = 1.0 / (from.pos.roomName == resource.pos.roomName ? from.pos.getRangeTo(resource.pos) : 70);
  const load_factor = resource.amount;
  const mid_full = load_factor > from.store.getFreeCapacity(RESOURCE_ENERGY);
  const bonus = mid_full ? 10.0 : 1.0;
  return bonus * load_factor * load_factor * range * range;
}

export function sourceScore(from: { pos: RoomPosition, store: StoreDefinition }, destination: { pos: RoomPosition, store: StoreDefinition }) {
  const range = 1.0 / (from.pos.roomName == destination.pos.roomName ? from.pos.getRangeTo(destination.pos) : 70);
  const load_factor = Math.min(2000, destination.store.getUsedCapacity(RESOURCE_ENERGY)); // Storage will be handle like container
  const mid_full = load_factor > from.store.getFreeCapacity(RESOURCE_ENERGY);
  // const is_full = destination.store.getFreeCapacity(RESOURCE_ENERGY) == 0;
  const bonus = mid_full ? 10.0 : 1.0;
  // const score = bonus * load_factor * load_factor * (is_full ? 1.0 : range * range);
  const score = bonus * load_factor * load_factor * range * range;
  return score;
}

export function buildScore(from: { pos: RoomPosition, store: StoreDefinition }, site: ConstructionSite) {
  const range = 1.0 / (from.pos.roomName == site.pos.roomName ? from.pos.getRangeTo(site.pos) : 70);
  const progressFactor = Math.max(0.1, site.progress) / site.progressTotal;
  const weight = getBuildWeigth(site);
  // const load_factor = destination.store.getUsedCapacity(RESOURCE_ENERGY);
  // const mid_full = load_factor > from.store.getFreeCapacity(RESOURCE_ENERGY);
  // const is_full = destination.store.getFreeCapacity(RESOURCE_ENERGY) == 0;
  // const bonus = mid_full ? 10.0 : 1.0;
  // const score = bonus * load_factor*load_factor * (is_full ? 1.0 : range*range);
  // return range*range;
  return weight + progressFactor * range;
}

export function destinationScore(from: { pos: RoomPosition, store: StoreDefinition }, destination: StoreStructure) {
  const range = 1.0 / (from.pos.roomName == destination.pos.roomName ? from.pos.getRangeTo(destination.pos) : 70);
  const loadFactor = from.store.getUsedCapacity(RESOURCE_ENERGY);
  const canBeFull = loadFactor > destination.store.getFreeCapacity(RESOURCE_ENERGY);
  const isEmpty = destination.store.getUsedCapacity(RESOURCE_ENERGY) == 0;
  const bonus = (canBeFull ? 10.0 : 1.0) + (isEmpty ? 100.0 : 1.0);
  const weight = getSupplyWeigth(destination as Structure);
  const score = bonus * weight * range * range;
  return score;
}

export function hostileScore(soldier: Agent, hostile: Creep) {
  const range = 1.0 / (soldier.pos.roomName == hostile.pos.roomName ? soldier.pos.getRangeTo(hostile.pos) : 70);
  const isHealer = haveBodyPart(hostile, HEAL) ? 100 : 1;
  const score = isHealer * range * range;
  return score;
}

export function scoutScore(probe: Agent, roomName: string) {

  const distanceScore = 1.0 / (getRoomRange(probe.pos.roomName, roomName) * 50);

  if (distanceScore > (probe.creep.ticksToLive ?? 0)) {
    // To far to be reachable
    return 0;
  }

  const explo = Exploration.exploration();

  const tickScore = explo.hasRoom(roomName) ? 1.0 - (1.0 / Game.time - (explo.getRoom(roomName)?.tick ?? 0)) : 1.0;


  return distanceScore * tickScore;
}