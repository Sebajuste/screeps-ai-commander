import { Exploration } from "Exploration";
import { HubCenterArea } from "area/hub/hubcenter-area";
import { Daemon } from "daemons";
import { Directive } from "directives/Directive";
import { RunActivity } from "hub/Hub";
import _ from "lodash";
import { log } from "utils/log";
import { getRoomRange } from "utils/util-pos";

const colors = {
  gray: '#555555',
  light: '#AAAAAA',
  road: '#666', // >:D
  energy: '#FFE87B',
  power: '#F53547',
  dark: '#181818',
  outline: '#8FBB93',
  speechText: '#000000',
  speechBackground: '#aebcc4',
  infoBoxGood: '#09ff00',
  infoBoxBad: '#ff2600'
};

export class ObserverDaemon extends Daemon {

  targetRoom?: string;

  hubCenterArea: HubCenterArea;

  nextRooms: string[];

  // invalidRooms: string[];

  constructor(initializer: HubCenterArea) {
    super(initializer.hub, initializer, 'observer', RunActivity.Always);
    this.hubCenterArea = initializer;
    this.nextRooms = [];
    // this.invalidRooms = [];
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

  observeRoom(roomName: string) {
    if (this.targetRoom) {
      // Store the current target to avoid lose it
      this.nextRooms.push(this.targetRoom);
    }
    this.targetRoom = roomName;
  }

  init(): void {

    this.initNextRooms();

  }

  /**
   * Run method for ObserverDaemon.
   * This method is responsible for observing rooms based on certain conditions and updating exploration data.
   */
  run(): void {

    if (!this.hubCenterArea.observer) {
      return;
    }

    log.debug(`${this.print} claim room: `, this.hub.memory.claimRoom);

    // Focus on claim room if necessary
    const claimRoom = this.hub.memory.claimRoom;
    if (claimRoom) {

      const haveCreep = _.find(Game.creeps, creep => creep.room.name == claimRoom) != undefined;

      if (!Game.rooms[claimRoom] || !haveCreep) {

        this.observeRoom(claimRoom);

        const result = this.hubCenterArea.observer.observeRoom(claimRoom);
        if (result != OK) {
          log.warning(`${this.print} Cannot observe Room : ${this.targetRoom}`);
        }

        return;
      }
    }



    const exploration = Exploration.exploration();

    if (this.targetRoom) {
      // If 1 room is already selected to be observed

      // 1. Observe target room
      const result = exploration.observerRoom(this.hubCenterArea.observer, this.targetRoom);
      if (result != OK) {
        log.error(`${this.print} Cannot observeRoom ${this.targetRoom}`);
      }
      this.targetRoom = undefined;
      /*
      const room = Game.rooms[this.targetRoom];
      if (room) {
        // If 1 room is visible, analyse it and reset target room
        exploration.analyseRoom(room);
        this.targetRoom = undefined;
      } else {
        // If 1 room is not visible, check if observer can observe it

        const result = this.hubCenterArea.observer.observeRoom(this.targetRoom);
        if (result != OK) {
          log.error(`${this.print} Cannot observeRoom ${this.targetRoom}`);
          // this.invalidRooms.push(this.targetRoom)
          exploration.invalidRooms.push(this.targetRoom);
          this.targetRoom = undefined;
        }
      }
        */
    }

    if (!this.targetRoom) {
      // If 1 room is not selected to be observed and observer exists

      // Select a new room to observe based on 3 conditions:
      // - Room must have been visited at least once
      // - Room must need an update (based on its last update time and the room TTL) and 1 room is not in invalidRooms list
      // - Room with the most recent tick should be selected

      /*
      const targetRoom = _.chain(Object.keys(exploration.getRooms()))//
        .filter(roomName => exploration.needUpdate(roomName) && !this.invalidRooms.includes(roomName))//
        .orderBy(roomInfo => exploration.getRoom(roomInfo)?.tick, ['desc'])//
        .first()//
        .value();
      */
      const targetRoom = exploration.nextRoom();

      if (targetRoom) {
        // If 1 room is found to be observed
        this.targetRoom = targetRoom;
        const result = this.hubCenterArea.observer.observeRoom(this.targetRoom);
        if (result != OK) {
          log.warning(`${this.print} Cannot observe Room : ${this.targetRoom}`);
        }
      }

    }

    if (!this.targetRoom && this.nextRooms.length > 0) {
      // If 1 room is not selected to be observed and there are rooms in the nextRooms list
      this.targetRoom = this.nextRooms.pop();
    }

    if (!this.targetRoom) {
      // If 1 room is still not selected to be observed, suspend the daemon for 20 ticks
      this.hub.dispatcher.suspendDaemon(this, 20);
    }

  }

  visuals(): void {

    if (this.targetRoom) {

      const mult = 25;

      const pos1 = new RoomPosition(25, 25, this.targetRoom);

      Game.map.visual.line(
        this.hub.pos,
        pos1,
        { color: colors.outline, opacity: 0.8, width: 1.0, lineStyle: 'dashed' }
      );

      Game.map.visual.circle(pos1, {
        fill: colors.dark,
        radius: 0.45 * mult,
        stroke: colors.outline,
        strokeWidth: 0.05 * mult,
        opacity: 0.5
      });

      const pos2 = new RoomPosition(25 + 0.225 * mult, 25, this.targetRoom);
      Game.map.visual.circle(pos2, {
        fill: colors.outline,
        radius: 0.20 * mult,
        opacity: 0.5
      });

    }

  }

}