import { Exploration } from "Exploration";
import { Agent } from "agent/Agent";
import { Hub } from "hub/Hub";
import { Tasks } from "task/task-builder";
import { TaskPipeline } from "task/task-pipeline";

export class ClaimerRole {

  static pipeline(roomName: string): TaskPipeline {

    const room = Game.rooms[roomName]
    if (room && room.controller) {
      return [Tasks.claim(room.controller)];
    }

    const roomInfo = Exploration.exploration().getRoom(roomName)!;

    if (roomInfo && roomInfo.controllerPos) {
      return [Tasks.claim({ pos: roomInfo.controllerPos })];
    }

    return [Tasks.claim({ pos: new RoomPosition(25, 25, roomName) })];

  }

}