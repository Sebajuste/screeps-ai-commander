import { HubCenterArea } from "area/hub/hubcenter-area";
import { Daemon } from "daemons";
import { RunActivity } from "hub/Hub";

export class NukerDaemon extends Daemon {

  private nuker: StructureNuker;

  constructor(area: HubCenterArea) {
    super(area.hub, area, 'nuker', RunActivity.Always);
    this.nuker = area.nuker!;
  }

  init(): void {
    const logisticsNetwork = this.hub.logisticsNetwork;

    if (this.nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      logisticsNetwork.requestInput(this.nuker, RESOURCE_ENERGY);
    }

    if (this.nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
      logisticsNetwork.requestInput(this.nuker, RESOURCE_GHODIUM);
    }
  }

  run(): void {

  }

  visuals(): void {
    Game.map.visual.circle(this.nuker.pos, { fill: 'transparent', radius: NUKE_RANGE * 50, stroke: '#ff0000', strokeWidth: 5.0 });
  }

}
