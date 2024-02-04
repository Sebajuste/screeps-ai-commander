/**
 * https://docs.screeps.com/simultaneous-actions.html
 */

import { Agent } from "agent/Agent";
import { Task } from "task/Task";
import { StoreStructure, Tasks, isResource, isStoreStructure, isTargetPosition, isTombstone } from "task/task-builder";
import { Hub } from "hub/Hub";
import { log } from "utils/log";
import _ from "lodash";
import { findClosestByLimitedRange, getMultiRoomRange, getRoomRange } from "utils/util-pos";
import { TaskPipeline } from "task/task-pipeline";
import { LogisticsRequest } from "logistics/logistics-network";
import { Settings } from "settings";
import { getSignFromRoom, selectSignText } from "utils/sign-text";
import { destinationScore, dropScore, hostileScore, scoutScore, sourceScore } from "./roles-utils";
import { haveBodyPart } from "agent/agent-builder";

export class BuilderRole {

  static pipeline(hub: Hub, agent: Agent, constructionSite: ConstructionSite): TaskPipeline {

    const pipeline: TaskPipeline = [];

    if (agent.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Build
      pipeline.push(Tasks.build(constructionSite))
    }

    const energyDrops = _.filter(hub.dropsByRooms[constructionSite.pos.roomName] ?? [], drop => drop.resourceType == RESOURCE_ENERGY);
    const nearestDrop = constructionSite.pos.findClosestByRange(energyDrops);


    const storeStructures = _.chain(hub.containersByRooms[constructionSite.pos.roomName] as StoreStructure[] ?? [])//
      .concat([hub.storage as any | undefined])//
      .compact()//
      .filter(storeStructure => storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0)//
      .value();



    // const containers = hub.containersByRooms[constructionSite.pos.roomName] ?? [];
    // const stores = _.concat(containers, [hub.storage as any]) as StoreStructure[];
    // const containers = _.filter(hub.containersByRooms[constructionSite.pos.roomName] ?? [], container => container.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
    const nearestContainer = constructionSite.pos.findClosestByRange(storeStructures);

    if (nearestDrop && nearestContainer) {

      const dropRange = nearestDrop.pos.getRangeTo(constructionSite.pos);
      const containerRange = nearestContainer.pos.getRangeTo(constructionSite.pos);

      if (dropRange <= containerRange) {
        // Drop is the nearest
        pipeline.push(Tasks.pickup(nearestDrop));
      } else {
        // Container is the nearest
        pipeline.push(Tasks.withdraw(nearestContainer, RESOURCE_ENERGY));
      }

    } else {

      if (nearestDrop) {
        // Can pickup from drop
        pipeline.push(Tasks.pickup(nearestDrop));
      }

      if (nearestContainer) {
        // Can withdraw from container
        pipeline.push(Tasks.withdraw(nearestContainer, RESOURCE_ENERGY));
      }
    }

    return pipeline;
  }

}

export class CommandoRole {

  static pipeline(soldier: Agent, roomName: string, hostiles: Creep[], hostileStructures: Structure[]): TaskPipeline {

    if (hostiles.length > 0) {
      const hostileCreepTarget = _.first(_.orderBy(hostiles, hostile => hostileScore(soldier, hostile), ['desc']));

      const pipeline: TaskPipeline = [];

      if (hostileCreepTarget) {

        if (!haveBodyPart(soldier.creep, ATTACK) && hostileCreepTarget && hostileCreepTarget.pos.getRangeTo(soldier.pos) < 5) {
          // TODO : flee

        }

        // Attack Creep
        if (haveBodyPart(soldier.creep, RANGED_ATTACK)) {
          // return Tasks.attackRanged(hostileCreepTarget);

          if (haveBodyPart(soldier.creep, HEAL)) {
            // Heal range
          }

        } else {
          pipeline.push(Tasks.attack(hostileCreepTarget));

          if (haveBodyPart(soldier.creep, HEAL)) {
            // Heal range

            // Heal
          }

        }
      }

    }

    const structureTarget = _.last(_.sortBy(hostileStructures, 'hits'));

    if (structureTarget) {
      // Attack Structure
      return [Tasks.attack(structureTarget)];
    }

    return [Tasks.wait(new RoomPosition(25, 25, roomName), 20)];

    /*
    if (hostileCreepTarget) {
      // Attack Creep
      if (haveBodyPart(soldier.creep, RANGED_ATTACK)) {
        // return Tasks.attackRanged(hostileCreepTarget);

        if (haveBodyPart(soldier.creep, HEAL)) {
          // Heal range
        }

      } else {
        pipeline.push(Tasks.attack(hostileCreepTarget));

        if (haveBodyPart(soldier.creep, HEAL)) {
          // Heal range

          // Heal
        }

      }
    } else if (structureTarget) {
      // Attack Structure
      pipeline.push(Tasks.attack(structureTarget));
    } else {
      // Go to the battlefield
      pipeline.push(Tasks.wait(new RoomPosition(25, 25, roomName), 20))
    }

    // return Tasks.wait({ id: undefined, pos: new RoomPosition(25, 25, roomName) }, () => (true));
    // return Tasks.moveTo({ pos: new RoomPosition(25, 25, roomName) });

    return pipeline;

  }
  */

  }

}

export class GuardRole {

  static pipeline(agent: Agent, targetRoom?: string) {

    if (!targetRoom || agent.pos.roomName == targetRoom) {
      return []
    };

    return [Tasks.wait(new RoomPosition(25, 25, targetRoom), 20)];

  }

}

export class HarvestRole {

  static pipeline(hub: Hub, agent: Agent, source: Source, container?: StructureContainer | null, link?: StructureLink | null): Task[] {

    if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
      // Container full
      if (!link || link.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
        // No link, or link is full
        log.debug(`${agent.print} Container full and no link or link full`)
        return [];
      }
    }

    const pipeline: TaskPipeline = [];

    if (container && (agent.pos.roomName != container.pos.roomName || agent.pos.x == container.pos.x || agent.pos.y == container.pos.y)) {
      // Agent must go on the container
      pipeline.push(Tasks.wait(container.pos, 0));
    }


    //
    //
    //
    if (link && agent.haveBodyPart(CARRY) && link.hits < link.hitsMax) {
      // Need to repair Link

      pipeline.push(Tasks.repair(link));

      if (agent.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Take Energy to repair

        if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          pipeline.push(Tasks.withdraw(container, RESOURCE_ENERGY));
        } else {
          pipeline.push(Tasks.harvest(source, link));
        }

      }
      return pipeline;
    }

    //
    //
    //
    if (container && agent.haveBodyPart(CARRY) && container.hits < container.hitsMax) {
      // Need to repair container

      pipeline.push(Tasks.repair(container));

      if (agent.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Take Energy to repair

        if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          pipeline.push(Tasks.withdraw(container, RESOURCE_ENERGY));
        } else {
          pipeline.push(Tasks.harvest(source, container));
        }

      }
      return pipeline;
    }

    //
    //
    //
    if (link && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Harvest to Link

      // Need to take Energy
      if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 300) {
        // From Container
        pipeline.push(Tasks.withdraw(container, RESOURCE_ENERGY));
      } else {
        // From Harvest
        pipeline.push(Tasks.harvest(source, link));
      }

      pipeline.push(Tasks.transfer(link, RESOURCE_ENERGY));

      return pipeline;
    }

    //
    //
    //
    if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {

      if (agent.haveBodyPart(CARRY) && agent.store.getFreeCapacity(RESOURCE_ENERGY) == 0 && (container.store.getFreeCapacity(RESOURCE_ENERGY) ?? 0) > 0) {
        // Transfer to energy
        pipeline.push(Tasks.transfer(container, RESOURCE_ENERGY));
      }

      pipeline.push(Tasks.harvest(source, container));

      /*
      if (agent.haveBodyPart(CARRY)) {
        pipeline.push(Tasks.drop(agent.pos, RESOURCE_ENERGY));
      }
      */

      return pipeline;

    }

    pipeline.push(Tasks.harvest(source, container));

    return pipeline;
  }

}

export class HaulerRole {

  static pipeline(hub: Hub, agent: Agent, request?: LogisticsRequest): Task[] {

    if (request) {

      if (request.amount < 0) {
        // Output - Take

        if (isResource(request.target)) {
          return [Tasks.pickup(request.target)];
        } else if (isTombstone(request.target) || isStoreStructure(request.target)) {
          return [Tasks.withdraw(request.target, request.resourceType)];
        }

      } else {
        // Input - Drop

        if (isStoreStructure(request.target)) {
          return [Tasks.transfer(request.target, request.resourceType)];
        } else if (isTargetPosition(request.target)) {
          log.debug(`> Drop target : `, JSON.stringify(request.target));
          return [Tasks.drop(request.target.pos, request.resourceType)];
        }

      }

      log.warning(`${agent.print} Request cannot be process ${request.resourceType} ${request.amount} ${request.target.pos}`)

    } else {

      const resource = _.first(_.keys(agent.store)) as ResourceConstant | undefined;
      if (resource && hub.storage) {
        // Save current store
        return [Tasks.transfer(hub.storage, resource)];
      }

      log.debug(`${agent.print} Cannot found logistic request`);
    }

    /*
    if (hub.storage && agent.store.getUsedCapacity() > 0) {
      const resource = _.first(Object.keys(agent.store) as ResourceConstant[]);
      if (resource) {
        return [Tasks.transfer(hub.storage, resource)];
      }
    }
    */

    return [];
  }

}

export class MinerRole {

  static pipeline(hub: Hub, agent: Agent, mineral: Mineral, extractor?: StructureExtractor, container?: StructureContainer | null) {

    const pipeline: TaskPipeline = [];

    if (container && (agent.pos.roomName != container.pos.roomName || agent.pos.x == container.pos.x || agent.pos.y == container.pos.y)) {
      // Agent must go on the container
      pipeline.push(Tasks.wait(container.pos, 0));
    }

    if (mineral.mineralAmount > 0 && extractor && extractor.cooldown == 0) {
      pipeline.push(Tasks.harvest(mineral, container, true));
    }

    return pipeline;
  }

}

export class RepairRole {

  static pipeline(hub: Hub, agent: Agent, structure: Structure) {

    const pipeline: TaskPipeline = [];

    if (agent.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Repair
      pipeline.push(Tasks.repair(structure))
    }

    const energyDrops = _.filter(hub.dropsByRooms[structure.pos.roomName] ?? [], drop => drop.resourceType == RESOURCE_ENERGY);
    const nearestDrop = structure.pos.findClosestByRange(energyDrops);

    const containers = _.filter(hub.containersByRooms[structure.pos.roomName] ?? [], container => container.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
    const nearestContainer = structure.pos.findClosestByRange(containers);

    if (nearestDrop && nearestContainer) {
      // Choose between drop and container

      const dropRange = nearestDrop.pos.getRangeTo(structure.pos);
      const containerRange = nearestContainer.pos.getRangeTo(structure.pos);

      if (dropRange <= containerRange) {
        // Drop is the nearest
        pipeline.push(Tasks.pickup(nearestDrop));
      } else {
        // Container is the nearest
        pipeline.push(Tasks.withdraw(nearestContainer, RESOURCE_ENERGY));
      }

      return pipeline;
    }

    if (nearestDrop) {
      // Can pickup
      pipeline.push(Tasks.pickup(nearestDrop));
    }

    if (nearestContainer) {
      // Can withdraw
      pipeline.push(Tasks.withdraw(nearestContainer, RESOURCE_ENERGY));
    }

    if (!nearestDrop && !nearestContainer) {
      // Search energy into other rooms

      const nearestHubContainer = _.chain(hub.containers ?? [])//
        .filter(container => container.store.getUsedCapacity(RESOURCE_ENERGY) > 0)//
        .orderBy(container => getMultiRoomRange(container.pos, structure.pos), ['asc'])//
        .first()//
        .value();

      if (nearestHubContainer) {
        pipeline.push(Tasks.withdraw(nearestHubContainer, RESOURCE_ENERGY));
      }

    }



    return pipeline;

  }

}

export class ReserverRole {

  static pipeline(agent: Agent, roomName: string) {

    const room = Game.rooms[roomName];

    if (!room) {
      return [Tasks.wait(new RoomPosition(25, 25, roomName))];
    }

    if (room.controller) {
      return [Tasks.reserve(room.controller)];
    }

    return [];
  }

}

export class ScoutRole {

  static pipeline(hub: Hub, agent: Agent, nextRooms: string[]) {

    const pipeline: TaskPipeline = [];

    if (nextRooms.length == 0) {
      // No next room to explore

      const text = getSignFromRoom(hub, agent.creep.room);
      if (text) {
        pipeline.push(Tasks.sign(agent.creep.room.controller!, text));
      }
      return pipeline;
    }

    const roomName = agent.room.name;

    const agentMemory: any = agent.memory;

    // Define next room to explore for the current scout
    if (!agentMemory['nextRoom'] || agentMemory['nextRoom'] == roomName) {
      // Destination Room Reached

      const text = getSignFromRoom(hub, agent.creep.room);
      if (text) {
        pipeline.push(Tasks.sign(agent.creep.room.controller!, text));
      }

      log.debug(`ScoutRole for ${agent.print}. Destination room reached`);

      const nextRoom = _.first(_.orderBy(nextRooms, room => scoutScore(agent, room), ['desc']));

      _.remove(nextRooms, it => it == nextRoom);

      agentMemory['nextRoom'] = nextRoom;

      pipeline.push(Tasks.wait(new RoomPosition(25, 25, nextRoom!), 20));

      return pipeline;
    }

    if (agentMemory['nextRoom'] && agent.pos.roomName != agentMemory['nextRoom']) {
      // Invalid room

      const text = getSignFromRoom(hub, agent.creep.room);
      if (text) {
        pipeline.push(Tasks.sign(agent.creep.room.controller!, text));
      }

      log.debug(`ScoutRole for ${agent.print}. Invalid current room, agentMemory: ${agentMemory['nextRoom']}`);
      pipeline.push(Tasks.wait(new RoomPosition(25, 25, agentMemory['nextRoom']), 20));
      return pipeline;
    }

    delete agentMemory['nextRoom'];

    log.error(`${agent.print} cannot find next room to explore`);

    pipeline.push(Tasks.wait(new RoomPosition(25, 25, roomName), 20));
    return pipeline;
  }

}

export class SupplierRole {

  static pipeline(hub: Hub, agent: Agent, sources: StoreStructure[], destinations: StoreStructure[]): TaskPipeline {

    const fillRequired = _.filter(destinations, dest => dest.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

    if (fillRequired.length == 0) {
      // No action required
      return [];
    }

    const pipeline: TaskPipeline = [];

    let supplierEnergy = agent.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;

    if (agent.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Take Energy

      // From near drops
      const drops = agent.pos.findInRange(hub.dropsByRooms[agent.room.name], 5, { filter: (drop: Resource) => drop.resourceType == RESOURCE_ENERGY });
      const drop = _.first(_.orderBy(drops, d => dropScore(agent, d), ['desc']));

      if (drop) {
        _.remove(hub.dropsByRooms[agent.room.name], it => it == drop);
        pipeline.push(Tasks.pickup(drop));
        supplierEnergy += Math.min(drop.amount, agent.store.getFreeCapacity(RESOURCE_ENERGY));
      }

      if (supplierEnergy < agent.store.getCapacity(RESOURCE_ENERGY)) {

        // From Source
        const source: StoreStructure | undefined = _.last(_.sortBy(sources, source => sourceScore(agent, source)));
        if (source) {
          pipeline.push(Tasks.withdraw(source, RESOURCE_ENERGY));
          supplierEnergy += Math.min(source.store.getUsedCapacity(RESOURCE_ENERGY), agent.store.getCapacity(RESOURCE_ENERGY) - supplierEnergy);
        }
      }

    }

    if (pipeline.length == 0 && supplierEnergy == 0) {
      // No take energy task is set
      return [];
    }

    //if (agent.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
    // Supply Energy
    const sortedDestinations = _.orderBy(fillRequired, desination => destinationScore(agent, desination), ['desc']);

    for (const destination of sortedDestinations) {

      supplierEnergy -= Math.min(supplierEnergy, destination.store.getFreeCapacity(RESOURCE_ENERGY));
      pipeline.push(Tasks.transfer(destination, RESOURCE_ENERGY));
      if (supplierEnergy <= 0) {
        break;
      }
    }

    /*
    const destination: any | undefined = _.first(sortedDestinations);
    if (destination) {
      _.remove(destinations, it => it == destination);
      pipeline.push(Tasks.transfer(destination, RESOURCE_ENERGY));
    }
    */
    // }

    return pipeline;
  }



}

export class UpgradeRole {

  static pipeline(hub: Hub, agent: Agent, container?: StructureContainer, link?: StructureLink | null): TaskPipeline {

    const tasks: TaskPipeline = [];

    const storeStructure = link && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0 ? link : container;

    const haveEnergy = agent.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    const nearDrop = findClosestByLimitedRange(hub.controller.pos, hub.dropsByRooms[agent.pos.roomName], 5);
    const validContainer = storeStructure && storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;

    if (!haveEnergy && !nearDrop && !validContainer) {
      // Nothing to do, be close to the controller
      return [Tasks.wait(hub.controller.pos, 3)];
    }

    if (haveEnergy) {
      // Can upgrade
      tasks.push(Tasks.upgrade(hub.controller))
    }

    if (nearDrop) {
      // Can pick up from drop
      tasks.push(Tasks.pickup(nearDrop));
    }

    if (link && container) {
      // Dismantle container to avoid use energy to repair it
      tasks.push(Tasks.dismantle(container));
    } else if (validContainer) {
      // Take energy from tructure
      tasks.push(Tasks.withdraw(storeStructure, RESOURCE_ENERGY));
    }

    return tasks;
  }

}