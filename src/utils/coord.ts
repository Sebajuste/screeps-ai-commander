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