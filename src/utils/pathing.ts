import _ from "lodash";
import { log } from "./log";
import { Traveler } from "libs/traveler/traveler";

export class Pathing {

  /* Returns the shortest path from start to end position, regardless of (passable) terrain */
  static findShortestPath(startPos: RoomPosition, endPos: RoomPosition, options = {}) {
    _.defaults(options, {
      range: 1,
      offRoad: true,
      allowSK: true,
    });
    const ret = Traveler.findTravelPath(startPos, endPos, options);
    if (ret.incomplete) log.info(`Incomplete travel path from ${startPos} to ${endPos}!`);
    return ret;
  }


}