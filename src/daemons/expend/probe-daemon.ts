import { Actor } from "Actor";
import { Exploration, ExploredRoom } from "Exploration";
import { Agent, AgentRequestOptions, AgentSetup } from "agent/Agent";
import { AGENT_PRIORITIES } from "agent/agent-setup";
import { ScoutRole } from "agent/roles/roles";
import { Daemon } from "daemons/daemon";
import { Hub } from "hub/Hub";
import _ from "lodash";
import { Mem } from "memory/Memory";
import { registerOutpost } from "room/room-analyse";
import { Settings } from "settings";
import { log } from "utils/log";
import { getRoomRange } from "utils/util-pos";

interface ExplorerMemory {
  nextRooms: string[];
}

const DEFAULT_EXPLORER_MEMORY = {
  nextRooms: []
} as ExplorerMemory;

export class ProbeDaemon extends Daemon {

  explorerMemory: ExplorerMemory;

  nextRooms: string[];

  constructor(hub: Hub, initializer: Actor) {
    super(hub, initializer, 'probe');
    this.explorerMemory = Mem.wrap(initializer.memory, 'explorer', DEFAULT_EXPLORER_MEMORY);
    this.nextRooms = this.explorerMemory.nextRooms;
  }

  private finalize() {
    this.explorerMemory.nextRooms = this.nextRooms;
  }

  private spawnHandler() {

    if (this.nextRooms.length == 0) {
      return;
    }

    const options: AgentRequestOptions = {
      priority: AGENT_PRIORITIES.probe
    };

    const bodyParts = [MOVE, MOVE]

    const setup: AgentSetup = {
      role: 'probe',
      bodyParts: bodyParts
    };

    this.wishList(1, setup, options);

  }

  private initNextRooms() {

    if (this.nextRooms.length == 0) {
      // Need to find other rooms to explore

      log.debug('Scout Daemon init next rooms !')

      const exploration = Exploration.exploration();
      const exploredRooms = exploration.getRooms();

      this.nextRooms = _.chain(exploredRooms)//
        .map(room => room.exits)//
        .flatten()//
        .uniq()//
        .filter(roomName => exploration.needUpdate(roomName))//
        .orderBy(roomName => getRoomRange(this.pos.roomName, roomName), ['asc'])//
        .slice(0, 5)//
        .value();

      log.alert(`> this.nextRooms: ${this.nextRooms.length}`);
    }
  }

  /**
   * Add into next rooms the exits of the roomName
   * @param roomName 
   */
  private updateNextRoom(roomName: string): boolean {

    const exploration = Exploration.exploration();

    // Add next room for future exploration
    const roomInfo = exploration.getRoom(roomName);
    if (roomInfo) {
      const newExits = roomInfo.exits;

      // remove already explored room to next visit list
      const newNextRooms = _.filter(newExits, roomName => !exploration.hasRoom(roomName) && Game.map.getRoomStatus(roomName).status == "normal");

      // Update next room list
      this.nextRooms = _.uniq(_.concat(newNextRooms, this.nextRooms));

      return true;
    }

    return false;
  }

  /**
   * Update exploration for the current probe location
   * @param probe 
   */
  private lookRoom(probe: Agent) {
    const roomName = probe.room.name;

    const exploration = Exploration.exploration();


    const room = Game.rooms[roomName];
    if (room.controller && (room.controller.sign?.username != Settings.Username || room.controller.sign?.text == '[object Object]' || room.controller.sign?.text == 'undefined')) {
      // Need to update sign
      probe.taskPipelineHandler.clear(); // Clean to force rebuild with sign
    }


    // Add scout room if not exists or update his current room
    const isNewRoom = !exploration.hasRoom(roomName);
    if (isNewRoom || exploration.needUpdate(roomName)) {
      exploration.analyseRoom(probe.room);
    }

    if (isNewRoom) {
      // Add exits into next rooms
      this.updateNextRoom(roomName);
    }

    // Remove into next room the current room reached
    _.remove(this.nextRooms, it => it == roomName);

  }

  private processOutpost() {


    if (this.hub.memory.outposts.length > Settings.hubOutpostAmount) {
      //  Clear errors
      this.hub.memory.outposts = _.slice(_.uniq(this.hub.memory.outposts), 0, Settings.hubOutpostAmount);
    }

    const roomRequireAmount = Settings.hubOutpostAmount - this.hub.memory.outposts.length;

    log.debug(`${this.print} roomRequireAmount: ${roomRequireAmount}, Settings.hubOutpostAmount: ${Settings.hubOutpostAmount}, this.hub.outposts.length: ${this.hub.memory.outposts.length}`);

    if (roomRequireAmount > 0) {
      // Find best outpost

      const exploration = Exploration.exploration();

      const hubRoomInfo = exploration.getRoom(this.hub.room.name);
      if (hubRoomInfo) {

        const outpostNames = _.map(this.hub.rooms, room => room.name);

        const nearRooms = exploration.getNearRooms(this.hub.room.name, 2);

        log.debug(`> nearRooms: ${nearRooms.length}`);

        const bestRooms = _.chain(nearRooms)//
          .filter(roomName => exploration.getRoom(roomName)?.haveEnnemy == false && !outpostNames.includes(roomName) && !exploration.isInvalid(roomName))// No ennemy and not already outpost
          .sortBy(roomName => {

            const distance = getRoomRange(this.hub.name, roomName); //Traveler.routeDistance(colony.name, roomName);

            const sources = exploration.getRoom(roomName)?.sourceCount ?? 0;
            const dt = 1.0 / distance;

            return sources * dt;

          }, ['desc'])//
          .slice(0, roomRequireAmount)//
          .value();

        log.debug(`> bestRooms: ${bestRooms.length} `);

        bestRooms.forEach(roomName => registerOutpost(this.hub, roomName));

      } else {
        log.error(`${this.print} No exploration data for hub ${this.hub.name}`);
      }

    }
  }

  init(): void {

    this.spawnHandler();

    this.initNextRooms();

    this.agents.forEach(agent => this.lookRoom(agent));

    this.finalize();

  }

  run(): void {

    this.autoRun(this.agents, agent => ScoutRole.pipeline(this.hub, agent, this.nextRooms));

    this.processOutpost();

  }

}