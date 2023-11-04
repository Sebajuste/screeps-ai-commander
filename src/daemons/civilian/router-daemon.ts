import { Agent, AgentRequestOptions, AgentSetup } from "agent/Agent";
import { selectBodyParts } from "agent/agent-builder";
import { AGENT_PRIORITIES, COMMANDER_TEMPLATE } from "agent/agent-setup";
import { HubCenterArea } from "area/hub/hubcenter-area";
import { Daemon } from "daemons";
import { RunActivity } from "hub/Hub";
import _ from "lodash";
import { Settings } from "settings";
import { StoreStructure, Tasks } from "task/task-builder";
import { TaskPipeline } from "task/task-pipeline";
import { log } from "utils/log";

export class RouterDaemon extends Daemon {

  commandCenter: HubCenterArea;

  constructor(commandCenter: HubCenterArea, priority?: number) {
    super(commandCenter.hub, commandCenter, 'router', RunActivity.Always, priority);
    this.commandCenter = commandCenter;
  }

  private spawnRouter() {


    if (!this.commandCenter.link || this.hub.links.length < 2) {
      // No router require if no link network exists
      return;
    }

    const options = { priority: AGENT_PRIORITIES.router, options: { spawn: this.commandCenter.coreSpawn, directions: [BOTTOM_RIGHT] } } as AgentRequestOptions;
    const setup: AgentSetup = {
      role: 'router',
      bodyParts: selectBodyParts(COMMANDER_TEMPLATE, this.hub.room.energyAvailable)
    };

    this.wishList(1, setup, options);

  }

  private createCommanderTask(router: Agent): TaskPipeline {

    const link = this.commandCenter.link;
    const storage = this.commandCenter.storage;

    const takeResourceTaskHandler = (resource: ResourceConstant, amount?: number) => {

      const drops = router.pos.lookFor(LOOK_RESOURCES);
      const resourceDrop = _.find(drops, drop => drop.resourceType == resource);
      if (resourceDrop) {
        // Take from Drop
        return Tasks.pickup(resourceDrop);
      }

      const tombstones = router.pos.lookFor(LOOK_TOMBSTONES);
      const tombstone = _.find(tombstones, tombstone => tombstone.store.getUsedCapacity(resource) > 0);
      if (tombstone) {
        // Take from Tombstone
        return Tasks.withdraw(tombstone, resource);
      }

      if (resource == RESOURCE_ENERGY && link && link.store.getUsedCapacity(RESOURCE_ENERGY) > Settings.hubCenterMinLinkEnergy) {
        // Take energy from link
        return Tasks.withdraw(link, resource, Math.min(amount ?? 1000, Settings.hubCenterMinLinkEnergy - link.store.getUsedCapacity(RESOURCE_ENERGY)));
      }

      if (storage && storage.store.getUsedCapacity(resource) > 0) {
        // Take resource from storage
        return Tasks.withdraw(storage, resource, amount);
      }
      return null;
    };

    const fillResourceHandler: (structure: StoreStructure, resource: ResourceConstant, quantity?: number) => TaskPipeline = (structure, resource = RESOURCE_ENERGY, quantity?: number) => {

      // const storeAmount = structure.store.getUsedCapacity(resource) ?? 0;
      const fillAmount = quantity ? Math.min(quantity, structure.store.getFreeCapacity(resource) ?? 0) : structure.store.getFreeCapacity(resource) ?? 0;

      if (fillAmount == 0) {
        // No Fill is required
        return [];
      }

      /*
      if (storeAmount > (quantity ?? structure.store.getCapacity(resource) ?? 0) || structure.store.getFreeCapacity(resource) == 0) {
        // No Fill is required
        return [];
      }
      */

      const routerAmount = router.store.getUsedCapacity(resource) ?? 0;

      const pipeline: TaskPipeline = [];

      if (routerAmount < fillAmount) {
        // Need resource from Link or Storage
        const amount = Math.abs(fillAmount - routerAmount);
        const task = takeResourceTaskHandler(resource, amount);
        if (task) {
          pipeline.push(task);
        }
      }



      // const commanderAmount = commander.store.getUsedCapacity(resource);

      if (routerAmount > 0) {
        // Refuel structure
        // const amount = (quantity != undefined) ? (storeAmount != undefined ? quantity - storeAmount : quantity) : undefined;
        pipeline.push(Tasks.transfer(structure as any, resource, fillAmount));
      }




      /*
      if (commander.store.getUsedCapacity(resource) <= (amount ?? 0)) {
          // Need resource from Link or Storage
          const task = takeResourceTaskHandler(resource, (amount == undefined) ? undefined : amount - commander.store.getUsedCapacity(resource));
          if (task) {
              return task;
          }
      }

      if (amount == undefined ? commander.store.getFreeCapacity(resource) == 0 : commander.store.getUsedCapacity(resource) >= amount) {
          // Refuel structure
          return Tasks.transfer(structure as any, resource, amount);
      }
      */

      return pipeline;
    };

    // Move to correct position to command
    /*
    if (!commander.creep.pos.isEqualTo(this.commandCenter.pos)) {
      return [Tasks.wait(this.commandCenter.pos)];
    }
    */

    /**
     * Keep Tower ready to use
     */

    const tower = _.first(_.orderBy(this.commandCenter.towers, (tower: StructureTower) => tower.store.getUsedCapacity(RESOURCE_ENERGY), ['asc'])) as StructureTower | undefined;
    if (tower && tower.store.getFreeCapacity(RESOURCE_ENERGY) >= 300) {
      // Tower need refuel
      return fillResourceHandler(tower, RESOURCE_ENERGY);
    }

    /**
     * Keep Spawn ready to use
     */
    const commanderSpawn = this.commandCenter.coreSpawn;
    if (commanderSpawn && commanderSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Spawn need refuel
      return fillResourceHandler(commanderSpawn, RESOURCE_ENERGY);
    }

    /**
     * Keep PowerSpawn ready to use
     */
    /*
    const powerSpawn = this.commandCenter.powerSpawn;
    if (powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // Spawn need refuel
      const task = fillResourceHandler(powerSpawn as any, RESOURCE_ENERGY);
      if (task) {
        return task;
      }
    }
    */

    /**
     * Keep Terminal ready to use
     */
    const terminal = this.commandCenter.terminal;
    if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubTerminalEnergy && storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
      // Fill energy if required, and enough available from Storage
      return fillResourceHandler(terminal as any, RESOURCE_ENERGY, Settings.hubTerminalEnergy - terminal.store.getUsedCapacity(RESOURCE_ENERGY));
    }

    /**
     * Keep Nuker ready to use
     */
    /*
    const nuker = this.commandCenter.nuker;
    if (nuker && nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 50000) {
        // Fill nuker with Energy
        const task = fillResourceHandler(nuker as any, RESOURCE_ENERGY);
        if (task) {
            return task;
        }
    }

    if (nuker && nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
        // Fill nuker with Ghodium
        const task = fillResourceHandler(nuker as any, RESOURCE_GHODIUM);
        if (task) {
            return task;
        }
    }
    */

    /**
     * Keep Link ready to use
     */
    if (link) {
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) > Settings.hubCenterMinLinkEnergy && router.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Vacuum link

        const amount = Math.min(link.store.getUsedCapacity(RESOURCE_ENERGY) - Settings.hubCenterMinLinkEnergy, router.store.getFreeCapacity(RESOURCE_ENERGY));
        return [Tasks.withdraw(link, RESOURCE_ENERGY, amount), Tasks.transfer(storage, RESOURCE_ENERGY)];
      }

      if (link.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubCenterMinLinkEnergy && storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
        // Fill Link

        const fillAmount = Settings.hubCenterMinLinkEnergy - link.store.getUsedCapacity(RESOURCE_ENERGY);

        const takeAmount = Math.max(0, fillAmount - router.store.getUsedCapacity(RESOURCE_ENERGY));
        const pipeline: TaskPipeline = [];

        if (takeAmount > 0) {
          pipeline.push(Tasks.withdraw(storage, RESOURCE_ENERGY, takeAmount));
        }
        pipeline.push(Tasks.transfer(link, RESOURCE_ENERGY, fillAmount));
        return pipeline;
      }
    }



    /**
     * If no energy is into storage
     */
    /*
    if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
  
        if (commander.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
            // Take energy from Link or Terminal
  
            if (link && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                // Take energy from Link
                return Tasks.withdraw(link);
            }
  
            if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 1000) {
                // Take energy from Terminal
                return Tasks.withdraw(storage, RESOURCE_ENERGY, terminal.store.getUsedCapacity(RESOURCE_ENERGY) - 1000);
            }
  
        }
  
        if (commander.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
            // Fill Storage
            return Tasks.transfer(storage);
        }
  
    }
    */

    /**
     * Save Energy by storing it
     */
    if (storage && router.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && storage.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubStorageMaxEnergy) {
      // Fill storage
      return [Tasks.transfer(storage, RESOURCE_ENERGY)];
    } else if (router.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // Drop Overrided Energy
      return [Tasks.drop(router.pos, RESOURCE_ENERGY)];
    }

    /**
     * Transfer imported resource from Terminal to Storage
     */
    if (terminal) {

      const terminalResources = _.keys(terminal.store) as ResourceConstant[];

      // Find imported and storable resource
      const importedResource = _.find(terminalResources, resource => {
        const isImported = _.find(this.hub.minerals, mineral => mineral.mineralType == resource) != undefined;
        const storageFull = storage.store.getUsedCapacity(resource) >= Settings.hubStorageMaxResource
        return !isImported && !storageFull;
      });



      if (importedResource) {
        // Imported resource is present in the terminal

        if (router.store.getUsedCapacity(importedResource) > 0) {
          // Put into Storage if the commander have resource
          return [Tasks.transfer(storage, importedResource)];
        }

        // Take resource from Terminal
        return [Tasks.withdraw(terminal, importedResource)];
      }

      if (storage) {

        const exportedResource = _.chain(this.hub.minerals)//
          .map(mineral => mineral.mineralType as ResourceConstant)//
          .filter(resource => {
            const isInStorage = storage.store.getUsedCapacity(resource) > 0;
            const isFullInTerminal = terminal.store.getUsedCapacity(resource) > 10000;
            return isInStorage && !isFullInTerminal;
          })//
          .orderBy(resource => terminal.store.getUsedCapacity(resource), ['asc'])//
          .first()//
          .value() as ResourceConstant | undefined;

        if (exportedResource) {
          // Exported resource is present in the Storage

          if (router.store.getUsedCapacity(exportedResource) > 0) {
            // Put into Terminal if the commander have resource
            return [Tasks.transfer(terminal, exportedResource)];
          }

          // Take resource from Storage
          return [Tasks.withdraw(storage, exportedResource)];
        }

      }

    }

    return [];
  }

  init(): void {

    this.spawnRouter();

    const link = this.commandCenter.link;
    if (link) {

      const upgradeLink = this.hub.areas.upgrade?.link;

      if (upgradeLink && upgradeLink.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.upgradeMinLinkEnergy && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        this.hub.linkNetwork.requestOutput(link);
      } else if (this.agents.length == 0 && link.store.getUsedCapacity(RESOURCE_ENERGY) > Settings.hubCenterMinLinkEnergy) {
        this.hub.logisticsNetwork.requestOutput(link, RESOURCE_ENERGY, link.store.getUsedCapacity(RESOURCE_ENERGY) - Settings.hubCenterMinLinkEnergy);
      }

      if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (!this.hub.areas.upgrade?.link || this.hub.areas.upgrade?.link.store.getUsedCapacity(RESOURCE_ENERGY) >= Settings.upgradeMinLinkEnergy || !this.hub.linkNetwork.hasRequest(this.hub.areas.upgrade?.link)) {
          // No upgrade link or upgrade link as enough energy
          this.hub.linkNetwork.requestInput(link);
        }
      }

    }


    /*
    const terminal = this.commandCenter.terminal;
    const storage = this.commandCenter.storage;
    
    if (terminal && storage) {
      _.forEach(this.hub.minerals, mineral => {

        if (terminal.store.getUsedCapacity(mineral.mineralType) > 0) {
          // Mineral can be tansfered to other colonies
          this.hub.terminalNetwork.requestOutput(terminal, mineral.mineralType);
        }

      });
    }
    */

  }

  run(): void {

    this.autoRun(this.agents, c => this.createCommanderTask(c));

  }

}