import { Hub } from "hub/Hub";
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
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW } from "cpu/process";


export class Commander {

  hubs: { [roomName: string]: Hub };				    // Global hash of all hub objects
  hubMap: { [roomName: string]: string };				// Global map of hub associations for possibly-null rooms

  directives: { [flag_name: string]: Directive };

  agents: Dictionary<Agent>;

  constructor() {
    this.hubs = {};
    this.hubMap = {};

    this.directives = {};

    this.agents = {};
  }

  private wrapAgents() {
    const agents: Dictionary<Agent> = {};
    for (const name in Game.creeps) {
      agents[name] = new Agent(Game.creeps[name]);
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

  private wrapNewAgents() {
    const creepNames = Object.keys(Game.creeps);

    const newCreepNames = _.filter(creepNames, name => _.find(this.agents, agent => agent.name == name) == undefined);
    const newAgents = _.map(newCreepNames, name => new Agent(Game.creeps[name]));

    return newAgents;
    /*
    newAgents.forEach(agent => {
      this.agents[agent.name] = agent;
    });

    return this.agents;
    */
  }

  private registerNewAgents(): void {

    const agentNames = Object.keys(this.agents);

    // const oldCreepNames = _.filter(agentNames, name => Game.creeps[name] == undefined);

    const validAgentNames = _.filter(agentNames, name => Game.creeps[name] != undefined);

    let updated = false;
    if (validAgentNames.length < agentNames.length) {
      // Remove from cach invalid Agent
      updated = true;
      this.agents = _.reduce(validAgentNames, (acc, name) => {
        acc[name] = this.agents[name];
        return acc;
      }, {} as Dictionary<Agent>);

    }

    // Remove from cach invalid Agent
    /*
    oldCreepNames.forEach(name => {
      log.debug(`DELETE agent `, name);
      updated = true;
      delete this.agents[name];
    });
    */

    // Update existing Agent creep
    _.forEach(_.values(this.agents) as Agent[], agent => {
      if (agent) {
        agent.refresh();
      }
    });

    // Wrap new Agent
    const newAgents = this.wrapNewAgents();
    log.debug('registerNewAgents : ', Object.keys(newAgents).length, ' ', JSON.stringify(_.map(newAgents, agent => agent.name)));

    if (Object.keys(newAgents).length > 0) {
      // Add new agents

      updated = true;

      this.agents = _.merge(this.agents, newAgents);

      /*
      const newAgentsByHub = _.groupBy(newAgents, agent => agent.memory.hub) as { [colonieName: string]: Agent[] };
      for (const hubName in newAgentsByHub) {
        // Merge new and old agents
        const hub = this.hubs[hubName];
        const newHubAgents = newAgentsByHub[hubName];
        hub.agents = _.concat([...hub.agents, ...newHubAgents]);
      }
      */

    }

    if (updated) {
      const agentsByHub = _.groupBy(this.agents, agent => agent.memory.hub);
      for (const hubName in agentsByHub) {
        const hub = this.hubs[hubName];
        hub.agents = agentsByHub[hubName];
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
        hub.scheduler.registerDirective(directive);
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

    _.forEach(this.hubs, hub => CPU.cpu().pushProcess(() => hub.refresh(), PROCESS_PRIORITY_HIGHT));
  }

  init() {

    _.forEach(this.hubs, hub => CPU.cpu().pushProcess(() => hub.init(), PROCESS_PRIORITY_HIGHT + 10));

  }

  run() {

    _.forEach(this.hubs, hub => CPU.cpu().pushProcess(() => hub.run(), PROCESS_PRIORITY_HIGHT + 20));

  }

  visuals() {

    _.forEach(this.hubs, hub => CPU.cpu().pushProcess(() => hub.visuals(), PROCESS_PRIORITY_LOW + 100));

  }

}
