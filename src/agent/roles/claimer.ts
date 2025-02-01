import { Exploration } from "Exploration";
import { Tasks } from "task/task-builder";
import { TaskPipeline } from "task/task-pipeline";

export class ClaimerRole {

  static pipeline(roomName: string): TaskPipeline {

    const room = Game.rooms[roomName]
    if (room && room.controller) {

      return [
        Tasks.attackController(room.controller),
        Tasks.claim(room.controller)
      ];
    }

    const roomInfo = Exploration.exploration().getRoom(roomName)!;

    if (roomInfo && roomInfo.controllerPos) {

      return [
        Tasks.attackController({ pos: roomInfo.controllerPos }),
        Tasks.claim({ pos: roomInfo.controllerPos })
      ];
    }

    return [Tasks.wait(new RoomPosition(25, 25, roomName), 10)];

  }

}