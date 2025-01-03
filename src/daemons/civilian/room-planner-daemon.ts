import { Actor } from "Actor";
import { PROCESS_PRIORITY_LOW } from "cpu/process";
import { Daemon } from "daemons";
import { Hub, RunActivity } from "hub/Hub";
import { RoomPlanner } from "hub/room-planner/room-planner";
import { DistanceTransform } from "utils/distance-transform";
import { log } from "utils/log";

export class RoomPlannerDaemon extends Daemon {

  private roomPlanner: RoomPlanner;

  constructor(hub: Hub, initializer: Actor, roomPlanner : RoomPlanner) {
    super(hub, initializer, 'room-planner', RunActivity.Always, PROCESS_PRIORITY_LOW);
    this.roomPlanner = roomPlanner;
  }

  refresh() {
    super.refresh();
    if( this.hub.spawns.length > 0) {
      this.roomPlanner.refresh();
    }
  }

  init(): void {

    if( this.hub.spawns.length == 0 && this.hub.constructionSites.length == 0) {
      // A spawn build is required

      const distanceTransformMap = DistanceTransform.computeWallDistance(this.hub.name);

      const result = DistanceTransform.getMaxPosition(distanceTransformMap);

      if( result ) {
        const [x, y] = result;
        const pos = new RoomPosition(x, y, this.hub.name);
        pos.createConstructionSite(STRUCTURE_SPAWN);
      } else {
        log.warning('Cannot create spawn ');
      }

    }

    if( this.hub.spawns.length > 0) {
      this.roomPlanner.init();
    }
  }

  run(): void {
    if( this.hub.spawns.length > 0) {
      this.roomPlanner.run();
    }
  }

}