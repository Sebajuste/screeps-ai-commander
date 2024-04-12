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
function isRoomEligible(roomName: string, hubMap: { [name: string]: string }, searchMineral?: MineralConstant) {

  log.debug(`> isRoomEligible ${roomName} for ${searchMineral}`);

  if (hubMap[roomName] != undefined) {
    log.debug(`> hub already exists`)
    return false;
  }

  const exploration = Exploration.exploration();

  if (!exploration.hasRoom(roomName)) {
    log.debug(`> unexplored`)
    return false;
  }

  const roomInfo = Exploration.exploration().getRoom(roomName)!;

  if (_.find(roomInfo.minerals, info => info.type == searchMineral!) == undefined) {
    log.debug(`> no mineral searched`)
    return false;
  }

  if (roomInfo.sourceCount < 2 || roomInfo.haveEnnemy) {
    log.debug(`> No enough source or have ennemy`)
    return false;
  }

  if ((roomInfo.maxWallDistance ?? 0) < 7) {
    log.debug(`> maxWallDistance to low`)
    return false;
  }



  log.debug('> OK')

  return true;
}

export function analyseNextHub(hubs: { [roomName: string]: Hub }, hubMap: { [name: string]: string }) {

  log.debug(`analyseNextHub`);

  // Create list of current available minerals
  const minerals = _.chain(hubs)//
    .map(hub => hub.minerals)//
    .flatten()//
    .map(mineral => mineral.mineralType)//
    .uniq()//
    .value();

  // Search the next mineral required
  //const searchMineral = _.first(_.filter(MINERAL_PRIORITY, resource => !minerals.includes(resource)));
  const searchMineral = _.first(_.difference(MINERAL_PRIORITY, minerals));

  if (!searchMineral) {
    log.debug(`> No mineral found`);
    return;
  }

  console.log(`> minerals: `, minerals, `, searchMineral: ${searchMineral}`)

  const exploration = Exploration.exploration();

  // Search the next room to create new HUB
  const nextRoom = _.chain(exploration.getRooms())//
    .keys()//
    .filter(roomName => isRoomEligible(roomName, hubMap, searchMineral))//
    .first()//
    // .orderBy() // Nearest as builder hub
    .value();

  log.debug(`> Next room : ${nextRoom}`);

  return nextRoom;

}


