import { Directive } from "directives/Directive";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { log } from "utils/log";
import { getMultiRoomRange } from "utils/util-pos";

export function setHarvestFlag(hub: Hub, source: Source) {
  const result = Directive.createFlagIfNotPresent(source.pos, 'harvest', COLOR_YELLOW);
  if (hub && result != ERR_INVALID_TARGET && result != ERR_NAME_EXISTS && result != ERR_INVALID_ARGS) {

    const flag = Game.flags[result];
    const flagMemory: any = flag.memory;
    flagMemory['hub'] = hub.name;
    flagMemory['hubDistance'] = getMultiRoomRange(flag.pos, hub.pos);
  }
}

export function createHubFlags(hub: Hub, room: Room) {

  log.debug('--- createHubFlags ---');

  Directive.createFlagIfNotPresent(new RoomPosition(46, 2, room.name), 'build', COLOR_BLUE);

  if (!hub.observer) {
    Directive.createFlagIfNotPresent(new RoomPosition(44, 1, room.name), 'scout', COLOR_GREEN);
  }

  if (hub.agents.length < 1 && hub.level == 1) {
    Directive.createFlagIfNotPresent(new RoomPosition(42, 2, room.name), 'bootstrap', COLOR_ORANGE);
  } else {
    Directive.removeFlagIfPresent(new RoomPosition(42, 2, room.name), 'bootstrap');
  }

  if (hub.memory.claimRoom) {
    const result = Directive.createFlagIfNotPresent(new RoomPosition(25, 25, hub.memory.claimRoom), 'claim', COLOR_PURPLE);
    if (result != ERR_INVALID_ARGS && result != ERR_INVALID_TARGET && result != ERR_NAME_EXISTS) {
      const flagMemory = Game.flags[result].memory as any
      flagMemory['hub'] = hub.ref;
    }
  }

}

export function createOutpostDirective(hub: Hub, roomName: string) {
  const pos = new RoomPosition(25, 25, roomName);

  const flagName = Directive.createFlagIfNotPresent(pos, 'outpost', COLOR_BLUE);
  if (flagName != ERR_INVALID_TARGET) {
    const newFlag = Game.flags[flagName];
    const flagMemory: any = newFlag.memory;
    flagMemory['hub'] = hub.ref;
    flagMemory['hubDistance'] = getMultiRoomRange(pos, hub.pos);
  }
}

export function registerOutpost(hub: Hub, roomName: string) {

  if (hub.memory.outposts.includes(roomName)) {
    // Outpost already registered
    return;
  }

  if (hub.spawns.length == 0) {
    // Not outpost for incubation hub
  }

  createOutpostDirective(hub, roomName);

  hub.memory.outposts.push(roomName)

}