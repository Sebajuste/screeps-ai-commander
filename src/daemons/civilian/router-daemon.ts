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

    let _energyDroped: Resource | null | undefined = undefined;
    const getEnergyDroped = (): Resource | null => {
      if (_energyDroped !== undefined && _energyDroped !== null) {
        // Is Init
        return _energyDroped;
      }
      if (_energyDroped === null) {
        // Init but not found
        return null;
      }
      const drops = router.pos.lookFor(LOOK_RESOURCES);
      const resourceDrop = _.find(drops, drop => drop.resourceType == RESOURCE_ENERGY);
      if (resourceDrop) {
        return _energyDroped = resourceDrop;
      }
      return _energyDroped = null;
    }

    let _energyAvailable: number | null = null;
    const getEnergyAvailable = () => {
      if (_energyAvailable !== null) {
        return _energyAvailable;
      }
      return _energyAvailable = storage.store.getUsedCapacity(RESOURCE_ENERGY) + (getEnergyDroped()?.amount ?? 0);
    };

    const takeResourcePipelineHandler = (resource: ResourceConstant, amount: number) => {

      const pipeline: TaskPipeline = [];

      let freeCapacity = router.store.getFreeCapacity(resource);

      const resourceDrop = getEnergyDroped();

      if (resourceDrop && amount > 0) {
        // Take from Drop
        pipeline.push(Tasks.pickup(resourceDrop));
        const take = Math.min(freeCapacity, resourceDrop.amount);
        amount = amount - take;
        freeCapacity = freeCapacity - take;
      }


      const tombstones = router.pos.lookFor(LOOK_TOMBSTONES);
      const tombstone = _.find(tombstones, tombstone => tombstone.store.getUsedCapacity(resource) > 0);
      if (tombstone && amount > 0 && freeCapacity > 0) {
        // Take from Tombstone
        pipeline.push(Tasks.withdraw(tombstone, resource));
        const take = Math.min(freeCapacity, tombstone.store.getUsedCapacity(resource));
        amount = amount - take;
        freeCapacity = freeCapacity - take;
      }

      if (resource == RESOURCE_ENERGY && link && link.store.getUsedCapacity(RESOURCE_ENERGY) > Settings.hubCenterMinLinkEnergy && amount > 0 && freeCapacity > 0) {
        // Take energy from link
        const quantity = Math.min(amount ?? 1000, Settings.hubCenterMinLinkEnergy - link.store.getUsedCapacity(RESOURCE_ENERGY));
        const take = Math.min(freeCapacity, quantity);
        pipeline.push(Tasks.withdraw(link, resource, take));
        amount = amount - take;
        freeCapacity = freeCapacity - take;
      }

      if (storage && storage.store.getUsedCapacity(resource) > 0 && amount > 0 && freeCapacity > 0) {
        // Take resource from storage
        const take = Math.min(freeCapacity, amount);
        pipeline.push(Tasks.withdraw(storage, resource, take));
        amount = amount - take;
        freeCapacity = freeCapacity - take;
      }

      return pipeline;
    };

    const fillResourceHandler: (structure: StoreStructure, resource: ResourceConstant, quantity?: number) => TaskPipeline = (structure, resource = RESOURCE_ENERGY, quantity?: number) => {

      const fillAmount = quantity ? Math.min(quantity, structure.store.getFreeCapacity(resource) ?? 0) : structure.store.getFreeCapacity(resource) ?? 0;

      if (fillAmount == 0) {
        // No Fill is required
        return [];
      }

      const routerAmount = router.store.getUsedCapacity(resource) ?? 0;

      const pipeline: TaskPipeline = [];

      if (routerAmount < fillAmount && router.store.getFreeCapacity(resource) > 0) {
        // Need resource from Link or Storage
        const amount = Math.abs(fillAmount - routerAmount);
        const takePipeline = takeResourcePipelineHandler(resource, amount);
        if (takePipeline.length == 0) {
          return [];
        }
        pipeline.push(...takePipeline);
      }

      pipeline.push(Tasks.transfer(structure as any, resource));

      return pipeline;
    };


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
     * Keep Link ready to use
     */
    if (link) {
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) > Settings.hubCenterMinLinkEnergy && router.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        // Vacuum link
        const amount = Math.min(link.store.getUsedCapacity(RESOURCE_ENERGY) - Settings.hubCenterMinLinkEnergy, router.store.getFreeCapacity(RESOURCE_ENERGY));
        return [Tasks.withdraw(link, RESOURCE_ENERGY, amount), Tasks.transfer(storage, RESOURCE_ENERGY)];
      }

      if (link.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubCenterMinLinkEnergy && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
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
     * Keep Terminal ready to use
     */
    const terminal = this.commandCenter.terminal;
    if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubTerminalEnergy && getEnergyAvailable() > 10000) {
      // Fill energy if required, and enough available from Storage
      return fillResourceHandler(terminal as any, RESOURCE_ENERGY, Settings.hubTerminalEnergy - terminal.store.getUsedCapacity(RESOURCE_ENERGY));
    }

    /**
     * Keep PowerSpawn ready to use
     */
    const powerSpawn = this.commandCenter.powerSpawn;
    if (powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && getEnergyAvailable() > 20000) {
      // Spawn need refuel
      return fillResourceHandler(powerSpawn as any, RESOURCE_ENERGY);
    }

    /**
     * Keep Nuker ready to use
     */
    const nuker = this.commandCenter.nuker;
    if (nuker && nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && getEnergyAvailable() > 50000) {
      // Fill nuker with Energy
      log.warning(`>> Fill nuker getEnergyAvailable: ${getEnergyAvailable()}`)
      return fillResourceHandler(nuker as any, RESOURCE_ENERGY);
    }

    if (nuker && nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0 && storage.store.getUsedCapacity(RESOURCE_GHODIUM) > 5000) {
      // Fill nuker with Ghodium
      return fillResourceHandler(nuker as any, RESOURCE_GHODIUM);
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
    if (router.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) < Settings.hubStorageMaxEnergy) {
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
        if (resource == RESOURCE_ENERGY) {
          return false;
        }
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

    this.autoRun(this.agents, agent => this.createCommanderTask(agent));

  }

}