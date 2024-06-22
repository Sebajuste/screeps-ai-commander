import { Exploration } from "Exploration";
import _ from "lodash";
import { Hub } from "../hub/Hub";
import { log } from "utils/log";
import { DistanceTransform } from "utils/distance-transform";

const MINERAL_PRIORITY: MineralConstant[] = [
  RESOURCE_LEMERGIUM,
  RESOURCE_OXYGEN,
  RESOURCE_KEANIUM
];

/**
 * Return true if a room can be eligible to expand
 * 
 * @param roomName The room to check
 * @param hubMap The list of the current HUBs
 * @param searchMineral The mineral required to search
 * @returns 
 */
function isRoomEligible(roomName: string, hubMap: { [name: string]: string }, searchMineral?: MineralConstant): boolean {

  // log.debug(`> isRoomEligible ${roomName} for ${searchMineral}`);

  if (hubMap[roomName] != undefined) {
    log.debug(`> hub ${roomName} already exists`)
    return false;
  }

  const exploration = Exploration.exploration();

  if (!exploration.hasRoom(roomName)) {
    log.debug(`> ${roomName} unexplored`)
    return false;
  }

  const roomInfo = exploration.getRoom(roomName)!;

  if (Game.time - roomInfo.tick > 1500000) {
    return false;
  }

  if (_.find(roomInfo.minerals, info => info.type == searchMineral!) == undefined) {
    // log.debug(`> ${roomName} no mineral ${searchMineral} searched`)
    return false;
  }

  if (roomInfo.sourceCount < 2 || roomInfo.haveEnnemy) {
    log.debug(`> ${roomName} No enough source ${roomInfo.sourceCount} or have ennemy ${roomInfo.haveEnnemy}`)
    return false;
  }

  if ((roomInfo.maxWallDistance ?? 0) < 7) {
    log.debug(`> ${roomName} maxWallDistance to low ${roomInfo.maxWallDistance}`)
    return false;
  }

  if (roomInfo.controlledBy !== undefined) {
    // Already controlled
    return false;

  }

  log.debug('> OK')

  return true;
}


function searchNextHub(mineralTarget: MineralConstant, hubMap: { [name: string]: string }) {
  const exploration = Exploration.exploration();

  // Search the next room to create new HUB
  const nextRoom = _.chain(exploration.getRooms())//
    .keys()//
    .filter(roomName => isRoomEligible(roomName, hubMap, mineralTarget))//
    .first()//
    // .orderBy() // Nearest as builder hub
    .value();

  log.debug(`> Next room : ${nextRoom}`);

  return nextRoom;
}

export function analyseNextHub(hubs: { [roomName: string]: Hub }, hubMap: { [name: string]: string }): string | null {

  // Create list of current available minerals
  const minerals = _.chain(hubs)//
    .map(hub => hub.minerals)//
    .flatten()//
    .map(mineral => mineral.mineralType)//
    .uniq()//
    .value();

  // Search the next mineral required
  const mineralTargets = _.difference(MINERAL_PRIORITY, minerals);

  do {
    const searchMineral = mineralTargets.shift();

    // console.log(`> minerals: `, minerals, `, searchMineral: ${searchMineral}`)

    if (!searchMineral) {
      log.debug(`> No mineral found`);
      return null;
    }

    const nextRoom = searchNextHub(searchMineral, hubMap);

    if (nextRoom) {
      return nextRoom;
    }

  } while (mineralTargets.length > 0);

  return null;
}


