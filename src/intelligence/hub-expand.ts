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

function isRoomEligible(roomName: string, hubMap: { [name: string]: string }, searchMineral?: MineralConstant) {

  if (hubMap[roomName] != undefined) {
    return false;
  }

  const roomInfo = Exploration.exploration().getRoom(roomName);

  if (!roomInfo) {
    return false;
  }

  if (roomInfo.sourceCount < 2 || roomInfo.haveEnnemy) {
    return false;
  }

  if ((roomInfo.maxWallDistance ?? 0) < 7) {
    return false;
  }

  if (_.find(roomInfo.minerals, info => info.type == searchMineral!) == undefined) {
    return false;
  }

  return true;
}

export function analyseNextHub(hubs: { [roomName: string]: Hub }, hubMap: { [name: string]: string }) {

  log.debug(`analyseNextHub`);

  const minerals = _.chain(hubs)//
    .map(hub => hub.minerals)//
    .flatten()//
    .map(mineral => mineral.mineralType)//
    .uniq()//
    .value();

  const searchMineral = _.first(_.filter(MINERAL_PRIORITY, resource => !minerals.includes(resource)));

  if (!searchMineral) {
    log.debug(`> No mineral found`);
    return;
  }

  const exploration = Exploration.exploration();

  const nextRoom = _.chain(exploration.getRooms())//
    .keys()//
    .filter(roomName => isRoomEligible(roomName, hubMap, searchMineral))//
    .first()//
    .value();

  log.debug(`> Next room : ${nextRoom}`);

  return nextRoom;

}


