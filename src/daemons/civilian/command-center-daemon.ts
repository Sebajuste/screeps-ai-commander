import { HubCenterArea } from "area/hub/hubcenter-area";
import { Daemon } from "daemons";

export class CommandCenterDaemon extends Daemon {

  commandCenter: HubCenterArea;

  constructor(commandCenter: HubCenterArea, priority?: number) {
    super(commandCenter.hub, commandCenter, 'commandCenter', priority);
    this.commandCenter = commandCenter;
  }

  init(): void {

    const terminal = this.commandCenter.terminal;
    const storage = this.commandCenter.storage;

  }

  run(): void {

  }

}