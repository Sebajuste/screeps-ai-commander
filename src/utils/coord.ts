import _ from "lodash";
import { log } from "./log";
import { isRoomPosition } from "task/task-builder";


const ROOM_COORD_PATTERN = /^[WE]([0-9]+)[NS]([0-9]+)$/;

export interface Coord {
  x: number;
  y: number;
}

export function coordToRoomPosition(coord: Coord, room: string): RoomPosition {
  return new RoomPosition(coord.x, coord.y, room);
}

export function coordFromRoomPosition(pos: RoomPosition): Coord {
  return { x: pos.x, y: pos.y };
}

export function coordName(coord: Coord): string {
  return coord.x + ':' + coord.y;
}

export function coordFromName(name: string): Coord {
  const split = _.map(name.split(':'), item => parseInt(item));
  return { x: split[0], y: split[1] };
}

export function isEqualCoord(coordA: Coord, coordB: Coord) {
  return coordA.x == coordB.x && coordA.y == coordB.y;
}

export function findNearValidPos(pos: Coord, roomName: string, avoid: Coord[] = []): Coord | undefined {
  const terrain = Game.map.getRoomTerrain(roomName);
  log.debug('> findNearValidPos ', JSON.stringify(pos))
  for (let x = pos.x - 1; x <= pos.x + 1; ++x) {

    if (x <= 1 || x >= 48) {
      continue;
    }

    for (let y = pos.y - 1; y <= pos.y + 1; ++y) {
      log.debug(`>>  check [${x}, ${y}]`)
      if (y <= 1 || y >= 48) {
        continue;
      }

      if (x == pos.x && y == pos.y) {
        continue;
      }

      if (terrain.get(x, y) == TERRAIN_MASK_WALL) {
        continue;
      }

      if (avoid.some(it => isEqualCoord(it, { x, y }))) {
        continue;
      }

      return { x, y };

    }
  }

}

export function isEqualRoomPosition(posA: RoomPosition, posB: RoomPosition) {
  return posA.roomName == posB.roomName && posA.x == posB.x && posA.y == posB.y;
}

export function roomWorldCoords(roomName: string): Coord {

  if (roomName === 'sim') {
    return { x: 0, y: 0 };
  }

  const parsed = ROOM_COORD_PATTERN.exec(roomName);

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