import { Hub, RunLevel } from "hub/Hub";
import { CPU } from "cpu/CPU";
import { Directive } from "directives/Directive";
import { OutpostDirective } from "directives/hub/outpost-directive";
import { Mem } from "memory/Memory";
import { flagRecalculateHub } from "utils/hub-utils";
import { log } from "utils/log";
import _, { Dictionary } from "lodash";
import { Agent } from "agent/Agent";
import { createDirective } from "directives/directive-builder";
import { createHubFlags } from "room/room-analyse";
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW, pushProcess } from "cpu/process";
import { Scheduler } from "cpu/scheduler";
import { analyseNextHub } from "intelligence/hub-expand";
import { getRoomRange } from "utils/util-pos";
import { Settings } from "settings";
import { Exploration } from "Exploration";
import { HubCenterArea } from "area/hub/hubcenter-area";


export class Commander {


  scheduler: Scheduler;

  hubs: { [roomName: string]: Hub };				    // Global hash of all hub objects
  hubMap: { [roomName: string]: string };				// Global map of hub associations for possibly-null rooms

  directives: { [flag_name: string]: Directive };

  agents: Dictionary<Agent>;

  constructor() {
    this.scheduler = new Scheduler();
    this.hubs = {};
    this.hubMap = {};

    this.directives = {};

    this.agents = {};
  }

  private wrapAgents() {
    const agents: Dictionary<Agent> = {};
    for (const name in Game.creeps) {
      agents[name] = new Agent(Game.creeps[name]);
      //agents[name] = Game.creeps[name] as Agent;
      //agents[name].refresh();
    }
    return agents;
  }

  private registerAgents() {
    const agents = this.wrapAgents();

    this.agents = agents;

    const agentsByHub = _.groupBy(agents, agent => agent.memory.hub);
    for (const hubName in agentsByHub) {
      const hub = this.hubs[hubName];
      if (hub) {
        hub.agents = agentsByHub[hubName];
      } else {
        log.error(`Invalid hub ${hubName} to register agents`);
      }

    }
  }

  private cleanHubs() {

    // Init colonies memory if required
    const hubsMemory = Mem.wrap(Memory, 'hubs', {}); // Init Hubs memory

    const hubNames = _.keys(hubsMemory);

    for (const name in hubNames) {
      if (!Game.rooms[name]) {
        delete hubNames[name];
      }
    }

  }

  private registerHubs() {

    const hubOutposts: { [roomName: string]: string[] } = {}; // key: lead room, values: outposts[]

    // Init colonies memory if required
    Mem.wrap(Memory, 'hubs', {}); // Init Hubs memory

    // Register Hub capitols
    for (const name in Game.rooms) {
      const room: Room = Game.rooms[name];
      if (room.controller?.my || name === 'sim') {
        hubOutposts[name] = [];
        this.hubMap[name] = name; // Set main room of Hub as outpost room
      }
    }

    // Register Hub outposts
    const outpostFlags = _.filter(Game.flags, flag => OutpostDirective.filter(flag));
    for (const flag of outpostFlags) {
      const flagMemory: any = flag.memory;
      if (!flagMemory.hub) {
        flagRecalculateHub(flag);
        log.warning(`Cannot determinage hub for flag `, flag);
      }
      const hubName = flagMemory.hub as string;
      const outpostName = flag.pos.roomName;
      if (hubOutposts[hubName] && !hubOutposts[hubName].includes(outpostName)) {
        this.hubMap[outpostName] = hubName; // Create an association between room and Hub name
        hubOutposts[hubName].push(outpostName);
      }
    }

    // Initialize the Colonies and give each one a Supervisor
    let maxId = _.max(_.map(this.hubs, hub => hub.id)) ?? 1;

    const newHubs = _.filter(_.keys(hubOutposts), name => !this.hubs.hasOwnProperty(name));

    _.forEach(newHubs, name => {
      const hub = new Hub(maxId++, name, hubOutposts[name], this);
      this.hubs[name] = hub;
      createHubFlags(hub, Game.rooms[name]);
    });

  }

  private registerDirective(flag: Flag, room: Room) {
    const roomName = room.name;
    const flagMemory: any = flag.memory;
    const hubName = flagMemory['hub'] ? flagMemory.hub : roomName;
    const hub = this.hubs[hubName];

    if (hub) {
      const directive = createDirective(this, flag, hub);
      if (directive) {
        this.directives[flag.name] = directive;
        hub.dispatcher.registerDirective(directive);
        directive.registerDaemons();
      } else {
        log.warning(`Cannot register directive for ${flag}`)
        // Directive.getFlagColony(Game.flags[name]).flags.push(Game.flags[name]);
      }
    } else {

      if (_.keys(this.hubs).length == 1) {
        const hubName = _.keys(this.hubs)[0];
        flagMemory['hub'] = hubName;
        log.info(`Attach flag ${flag.name}@${roomName} to ${hubName}`);
      } else {
        log.error(`No Hub for flag ${flag.name}@${roomName}, colonies: ${JSON.stringify(_.keys(this.hubs))}`)
      }
    }
  }

  removeDirective(directive: Directive) {

  }


  private registerDirectives(): void {

    if (_.keys(this.hubs).length == 0) {
      log.error('Cannot run registerDirectives. Cause : No HUB registered');
      return;
    }

    for (const name in Game.flags) {
      const flag = Game.flags[name];
      const room = flag.room;
      if (room && !this.directives[flag.name]) {
        this.registerDirective(flag, room);
      } else {
        if (!room) {
          // log.warning(`No room for flag ${flag.name}`);
        }
      }
    }
  }

  analyseRunLevel(hub: Hub) {

    if (Game.cpu.bucket < Settings.hubMinimalBucket && (Memory as any).generatePixel) {
      return RunLevel.MINIMAL;
    }

    const constructionCount = hub.constructionSites.length ?? 0;

    if (hub.level <= 3 || (hub.level == 4 && constructionCount > 0 && hub.storage && hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000)) {
      // Boost mode until lvl 4, stop when all constructions are done, and storage have enought energy, or no other hub exists
      return RunLevel.BOOST;
    }

    if (_.keys(this.hubs).length <= 1 && hub.level < 8) {
      return RunLevel.NORMAL_BOOST;
    }

    if (!hub.storage || !hub.towers || hub.towers.length == 0) {
      return RunLevel.NORMAL;
    }

    const energyAmount = hub.storage.store.getUsedCapacity(RESOURCE_ENERGY);
    if (energyAmount > 100000 && constructionCount == 0 && hub.level == 8) {
      // Minimal activity when level max is reached
      return RunLevel.ENDGAME_INDUSTRY;
    } else if (energyAmount > 100000 && constructionCount == 0) {
      // 
      return RunLevel.MINIMAL_UP;
    } else {
      return RunLevel.NORMAL;
    }

  }

  analyseNextHubToBuild() {

    const cpuPerHub = Game.cpu.limit / _.keys(this.hubs).length;
    if (cpuPerHub < Settings.hubMinTickCPU) {
      // Not enough CPU to create more HUB
      return;
    }

    const claimerHubs = _.chain(this.hubs)//
      .filter(hub => !hub.memory.claimRoom)// room that does not have already claim goal
      .filter(hub => hub.level > 7) // Only HUB lvl 8 can claim
      .filter(hub => hub.areas.hubCenter?.observer != undefined) // Must have an observer structure
      .filter(hub => hub.storage != undefined && hub.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 50000) // Enough energy in store
      .value();

    const minLevel = _.chain(this.hubs).map(hub => hub.level).min().value();

    const isClaiming = _.find(this.hubs, hub => hub.memory.claimRoom != undefined) != undefined;

    if (minLevel > 2 && claimerHubs.length > 0 && !isClaiming) {
      // Enable expansion only when all hubs are at least level 6, and at least one hub can claim

      const nextRoom = analyseNextHub(this.hubs, this.hubMap);

      if (nextRoom) {
        // If 1 room is found to build a new HUB

        const roomInfo = Exploration.exploration().getRoom(nextRoom);

        // TODO : if not roomInfo, push nextRoom into Observer list

        // 1. Select the nearest room to create a new HUB
        const startHub = _.chain(claimerHubs)//
          .orderBy(hub => getRoomRange(hub.pos.roomName, nextRoom), ['asc'])//
          .first()//
          .value();

        log.debug(`analyseNextHubToBuild next ${nextRoom} from ${startHub?.name ?? 'ukn'}`);

        /*
        if (!Game.rooms[nextRoom]) {
          // The room is not visible
          startHub.areas.hubCenter?.observer?.observeRoom(nextRoom);
          return;
        }
        */

        if (startHub && roomInfo && !roomInfo.haveEnnemy) {
          // 2. Select the nearest HUB to create colonizer

          startHub.memory.claimRoom = nextRoom;
          log.info(`Next room is ${nextRoom} from ${startHub.name} `);
        }
      }

    } else {
      if (minLevel <= 2) {
        log.info(`> A HUB is already in creation step`);
      } else if (isClaiming) {
        log.info(`> A HUB is already claiming`);
      } else {
        log.info(`> no HUB ready to fork`);
      }

    }
  }

  build() {
    this.cleanHubs();
    this.registerHubs();
    this.registerDirectives();
    this.registerAgents();
  }

  refresh() {
    this.registerHubs();
    this.registerDirectives();
    this.registerAgents();
  }

  init() {

    _.forEach(this.hubs, hub => {
      hub.processStack = [];
      pushProcess(hub.processStack, () => {
        hub.refresh();
        const runLevel = this.analyseRunLevel(hub);
        if (runLevel != hub.runLevel) {
          log.info(`${hub.print} has changed run level from ${hub.runLevel} to ${runLevel}`);
          hub.runLevel = runLevel;
        }
      }, PROCESS_PRIORITY_HIGHT)
    });

    _.forEach(this.hubs, hub => pushProcess(hub.processStack, () => hub.init(), PROCESS_PRIORITY_HIGHT + 10));

    this.analyseNextHubToBuild();

  }

  run() {

    _.forEach(this.hubs, hub => pushProcess(hub.processStack, () => hub.run(), PROCESS_PRIORITY_HIGHT + 20));

  }

  visuals() {

    Game.map.visual.clear();

    // _.forEach(this.hubs, hub => pushProcess(hub.processStack, () => hub.visuals(), PROCESS_PRIORITY_LOW + 100));
    _.forEach(this.hubs, hub => hub.visuals());

  }

  scheduleProcess(): Scheduler {

    const group = _.map(this.hubs, hub => hub.processStack);

    this.scheduler.init(group);

    return this.scheduler;
  }

}
