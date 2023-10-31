import { Hub, RunActivity } from "./hub/Hub";


export interface Actor {
  name: string;
  ref: string;
  hub: Hub;
  room: Room;
  pos: RoomPosition;
  memory: Memory | FlagMemory;
  performanceReport: { [stat: string]: number };
}
