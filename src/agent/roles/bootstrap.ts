import { Agent } from "../Agent";
import { Hub } from "../../hub/Hub";
import { TaskPipeline } from "../../task/task-pipeline";
import { StoreStructure, Tasks } from "task/task-builder";
import _ from "lodash";
import { dropScore, harvestSourceScore, sourceScore } from "./roles-utils";


export class BootstrapRole {

  static pipeline(hub: Hub, agent: Agent): TaskPipeline {

    const pipeline: TaskPipeline = [];

    if (agent.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Fill

      const destination = _.head(_.filter([...hub.spawns, ...hub.extentions], spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0)) as StoreStructure | undefined;

      if (destination) {
        pipeline.push(Tasks.transfer(destination, RESOURCE_ENERGY))
      }

      return pipeline;
    }

    if (agent.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
      //Obtain energy

      const drops = agent.pos.findInRange(hub.dropsByRooms[agent.room.name], 5, { filter: (drop: Resource) => drop.resourceType == RESOURCE_ENERGY });
      const drop = _.head(_.orderBy(drops, d => dropScore(agent, d), ['desc']));

      if (drop) {
        pipeline.push(Tasks.pickup(drop));
      }
      else {

        const source = _.chain(hub.sources)//
          .filter(source => source.room.name == agent.pos.roomName && source.energy > 0)//
          .orderBy(source => harvestSourceScore(agent, source), ['desc'])//
          .head()//
          .value();

        if (source) {
          pipeline.push(Tasks.harvest(source));
        }
      }

    }

    return pipeline;

  }

}