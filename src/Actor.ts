import { Hub } from "./hub/Hub";


export interface Actor {
  name: string;
  ref: string;
  hub: Hub;
  room: Room;
  pos: RoomPosition;
  memory: Memory | FlagMemory;
}
