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
      hub.agents = agentsByHub[hubName];
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
      const hub = new Hub(maxId++, name, hubOutposts[name]);
      this.hubs[name] = hub;
      // setRoomFlags(name, hub);
      createHubFlags(Game.rooms[name]);
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
        // Directive.getFlagColony(Game.flags[name]).flags.push(Game.flags[name]);
      }
    } else {

      if (_.keys(this.hubs).length == 1) {
        const hubName = _.keys(this.hubs)[0];
        flagMemory['hub'] = hubName;
        log.info(`Attach flag ${flag.name}@${roomName} to ${hubName}`);
      } else {
        log.warning(`No Hub for flag ${flag.name}@${roomName}, colonies: ${JSON.stringify(_.keys(this.hubs))}`)
      }
    }
  }

  removeDirective(directive: Directive) {

  }


  private registerDirectives(): void {

    for (const name in Game.flags) {
      const flag = Game.flags[name];
      const room = flag.room;
      if (room && !this.directives[flag.name]) {
        this.registerDirective(flag, room);
      } else {
        if (!room) {
          log.warning(`No room for flag ${flag.name}`);
        }
      }
    }
  }

  analyseRunLevel(hub: Hub) {

    if (Game.cpu.bucket < 5000) {
      return hub.runLevel = RunLevel.MINIMAL;
    }

    if (hub.level < 4) {
      return hub.runLevel = RunLevel.BOOST;
    }

    if (hub.storage) {
      const energyAmount = hub.storage.store.getUsedCapacity(RESOURCE_ENERGY);
      if (energyAmount > 100000) {
        hub.runLevel = RunLevel.STANDBY;
      } else if (energyAmount > 50000) {
        hub.runLevel = RunLevel.LIMITED;
      } else if (energyAmount > 10000) {
        hub.runLevel = RunLevel.NORMAL;
      } else if (energyAmount < 2000) {
        hub.runLevel = RunLevel.MINIMAL;
      } else {
        hub.runLevel = RunLevel.NORMAL;
      }



    } else {
      hub.runLevel = RunLevel.NORMAL;
    }


  }

  build() {
    this.registerHubs();
    this.registerDirectives();
    this.registerAgents();
  }

  refresh() {
    this.registerHubs();
    this.registerDirectives();
    // this.registerNewAgents();
    this.registerAgents();

    _.forEach(this.hubs, hub => {
      hub.processStack = [];
      pushProcess(hub.processStack, () => {
        hub.refresh();
        this.analyseRunLevel(hub);
      }, PROCESS_PRIORITY_HIGHT)
    });
  }

  init() {

    _.forEach(this.hubs, hub => pushProcess(hub.processStack, () => hub.init(), PROCESS_PRIORITY_HIGHT + 10));

  }

  run() {

    _.forEach(this.hubs, hub => pushProcess(hub.processStack, () => hub.run(), PROCESS_PRIORITY_HIGHT + 20));

  }

  visuals() {

    // _.forEach(this.hubs, hub => pushProcess(hub.processStack, () => hub.visuals(), PROCESS_PRIORITY_LOW + 100));
    _.forEach(this.hubs, hub => hub.visuals());

  }

  scheduleProcess(): Scheduler {

    const group = _.map(this.hubs, hub => hub.processStack);

    this.scheduler.init(group);

    return this.scheduler;
  }

}
