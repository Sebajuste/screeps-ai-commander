import _ from "lodash";
import { log } from "./log";
import { Pathing } from "./pathing";

export function flagRecalculateHub(flag: Flag, restrictDistance: number = 10) {
  log.info(`Recalculating colony association for ${flag.name} in ${flag.pos.roomName}`);
  let nearestHubName = '';
  let minDistance = Infinity;
  let hubRooms = _.filter(Game.rooms, room => room.controller?.my || false);
  for (const room of hubRooms) {
    const path = Pathing.findShortestPath(flag.pos, room.controller!.pos, { restrictDistance: restrictDistance }).path;
    if (path) {
      if (path.length < minDistance) {
        nearestHubName = room.name;
        minDistance = path.length;
      }
      log.info(`Path length to ${room.name}: ${path.length}`);
    } else {
      log.info(`Incomplete path found to ${room.name}`);
    }
  }
  if (nearestHubName != '') {
    log.info(`Best match: ${nearestHubName!}`);
    const flag_memory: any = flag.memory;
    flag_memory['hub'] = nearestHubName;
  } else {
    log.warning(`Could not find colony match for ${flag.name} in ${flag.pos.roomName}!`);
  }

}