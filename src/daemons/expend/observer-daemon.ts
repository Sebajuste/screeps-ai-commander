import { Exploration } from "Exploration";
import { HubCenterArea } from "area/hub/hubcenter-area";
import { Daemon } from "daemons";
import { Directive } from "directives/Directive";
import { RunActivity } from "hub/Hub";
import _ from "lodash";
import { log } from "utils/log";
import { getRoomRange } from "utils/util-pos";

export class ObserverDaemon extends Daemon {

  targetRoom?: string;

  hubCenterArea: HubCenterArea;

  nextRooms: string[];

  constructor(initializer: HubCenterArea) {
    super(initializer.hub, initializer, 'observer', RunActivity.Always);
    this.hubCenterArea = initializer;
    this.nextRooms = [];

    Directive.removeFlagIfPresent(new RoomPosition(44, 1, initializer.room.name), 'scout');
  }

  private initNextRooms() {

    if (this.nextRooms.length > 0) {
      // No need to find other rooms to explore
      return;
    }

    const exploration = Exploration.exploration();
    const exploredRooms = exploration.getRooms();

    if (Object.keys(exploredRooms).length == 0) {
      // Init exploration
      exploration.analyseRoom(this.room);
    }

    this.nextRooms = _.chain(exploredRooms)//
      .map(room => room.exits)//
      .flatten()//
      .uniq()//
      .filter(roomName => exploration.needUpdate(roomName) && Game.map.getRoomStatus(roomName).status == "normal" && getRoomRange(this.roomName, roomName) < 10)//
      .orderBy(roomName => getRoomRange(this.pos.roomName, roomName), ['asc'])//
      .slice(0, 5)//
      .value();

    log.alert(`> this.nextRooms: ${this.nextRooms.length}`);

  }

  init(): void {

    this.initNextRooms();

  }

  run(): void {

    log.warning(`ObserverDaemon`)

    const exploration = Exploration.exploration();

    if (this.targetRoom) {
      const room = Game.rooms[this.targetRoom];
      if (room) {
        log.debug(`> analyseRoom ${room.name}`)
        exploration.analyseRoom(room);
        this.targetRoom = undefined;
      } else {
        log.error(`Cannot access to ${this.targetRoom}`);

        if (this.hubCenterArea.observer) {
          const result = this.hubCenterArea.observer.observeRoom(this.targetRoom);
          log.debug(`> observeRoom : ${result}`);
          if (result != OK) {
            this.targetRoom = undefined;
          }
        }

      }
    }

    if (!this.targetRoom && this.hubCenterArea.observer) {

      const targetRoom = _.chain(Object.keys(exploration.getRooms()))//
        .filter(roomName => exploration.needUpdate(roomName))//
        .orderBy(roomInfo => exploration.getRoom(roomInfo)?.tick, ['desc'])//
        .first()//
        .value();

      if (targetRoom) {
        log.debug(`> roomInfo: ${targetRoom}`);
        this.targetRoom = targetRoom;
        const result = this.hubCenterArea.observer.observeRoom(this.targetRoom);
        log.debug(`> observeRoom : ${result}`);
      }

    }

    if (!this.targetRoom && this.nextRooms.length > 0) {
      this.targetRoom = this.nextRooms.pop();
      log.debug(`> next nexw room ${this.targetRoom}`);
    }

    if (!this.targetRoom) {
      log.warning(`> No next room`);
      this.hub.dispatcher.suspendDaemon(this, 20);
    }

  }

}