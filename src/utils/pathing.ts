import _ from "lodash";
import { log } from "./log";
import { Traveler } from "libs/traveler/traveler";
import { Coord } from "./coord";



export class Pathing {

  private static ROOM_COORD_PATTERN = /^[WE]([0-9]+)[NS]([0-9]+)$/;

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

  static roomWorldCoords(roomName: string): Coord {

    if (roomName === 'sim') {
      return { x: 0, y: 0 };
    }

    const parsed = Pathing.ROOM_COORD_PATTERN.exec(roomName);

    if (!parsed) {
      log.error(`Cannot parse [${roomName}] to define world position`);
      return { x: 0, y: 0 };
    }

    let x = parseInt(parsed![1], 10);
    let y = parseInt(parsed![2], 10);
    if (roomName.includes('W')) x = -x;
    if (roomName.includes('N')) y = -y;
    return { x: x, y: y } as Coord;
  }

  static distance(from: RoomPosition, to: RoomPosition) {

    if (from.roomName == to.roomName) {
      return from.getRangeTo(to);
    } else {
      const worldPosFrom = Pathing.roomWorldCoords(from.roomName);
      const worldPosTo = Pathing.roomWorldCoords(to.roomName);
      const dwx = Math.abs(50 * (worldPosTo.x - worldPosFrom.x));
      const dwy = Math.abs(50 * (worldPosTo.y - worldPosFrom.y));
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      return dwx + dwy + Math.max(dx, dy)
    }

  }


}