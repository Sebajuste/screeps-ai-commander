import _ from "lodash";
import { roomWorldCoords } from "./coord";

/** @deprecated */
export function lookForStructure(pos: RoomPosition, structureType: string): Structure[] {

    return pos.lookFor(LOOK_STRUCTURES).filter(structure => structure.structureType == structureType);

}

export function findClosestByLimitedRange<T extends RoomObject>(pos: RoomPosition, objects: T[], range: number, options?: { filter: any | string; }): T | null {
    const inRange = pos.findInRange(objects, range, options);
    return pos.findClosestByRange(inRange, options);
}

export function getMultiRoomRange(from: RoomPosition, to: RoomPosition): number {
    if (from.roomName == to.roomName) {
        return from.getRangeTo(to);
    } else {
        const worldPosFrom = roomWorldCoords(from.roomName);
        const worldPosTo = roomWorldCoords(to.roomName);
        const dwx = Math.abs(50 * (worldPosTo.x - worldPosFrom.x));
        const dwy = Math.abs(50 * (worldPosTo.y - worldPosFrom.y));
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        return dwx + dwy + Math.max(dx, dy)
    }
}

export function getRoomRange(from: string, to: string): number {
    if (from === to) {
        return 0;
    }
    const worldPosFrom = roomWorldCoords(from);
    const worldPosTo = roomWorldCoords(to);
    const dx = Math.abs(worldPosTo.x - worldPosFrom.x);
    const dy = Math.abs(worldPosTo.y - worldPosFrom.y);
    return Math.max(dx, dy);
}

export function printPos(pos: RoomPosition) {
    return '<a href="#!/room/' + Game.shard.name + '/' + this.roomName + '">[' + this.roomName + ', ' + this.x + ', ' + this.y + ']</a>';
}

