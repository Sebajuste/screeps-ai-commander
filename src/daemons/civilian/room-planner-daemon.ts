import { Actor } from "Actor";
import { PROCESS_PRIORITY_LOW } from "cpu/process";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { BunkerRoomPlanner } from "hub/room-planner/bunker-room-planner";
import { RoomPlanner } from "hub/room-planner/room-planner";

export class RoomPlannerDaemon extends Daemon {

  private roomPlanner: RoomPlanner;

  constructor(hub: Hub, initializer: Actor, roomPlanner : RoomPlanner) {
    super(hub, initializer, 'room-planner', RunActivity.Always, PROCESS_PRIORITY_LOW);
    this.roomPlanner = roomPlanner;
  }

  refresh() {
    super.refresh();
    this.roomPlanner.refresh();
  }

  init(): void {
    this.roomPlanner.init();
  }

  run(): void {
    this.roomPlanner.run();
  }

}