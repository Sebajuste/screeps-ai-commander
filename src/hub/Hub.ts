import { Mem } from "memory/Memory";
import { log } from "utils/log";
import { Dispatcher } from "./dispatcher";
import { Agent } from "agent/Agent";
import { AgentFactoryArea } from "area/hub/agent-factory";
import { Area } from "area/Area";
import { getMultiRoomRange } from "utils/util-pos";
import { LogisticsNetwork } from "logistics/logistics-network";
import _, { Dictionary } from "lodash";
import { UpgradeArea } from "area/hub/upgrade-area";
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW, PROCESS_PRIORITY_NORMAL, ProcessStack, pushProcess } from "cpu/process";
import { Settings } from "settings";
import { setHarvestFlag } from "room/room-analyse";
import { RoomPlanner } from "./room-planner/room-planner";
import { BunkerRoomPlanner } from "./room-planner/bunker-room-planner";
import { Coord } from "utils/coord";
import { Visualizer } from "ui/visualizer";
import { HubCenterArea } from "area/hub/hubcenter-area";
import { LinkNetwork } from "logistics/link-network";
import { MineralArea } from "area/hub/mineral-area";


interface HubMemory {
  bootstrap: boolean;
  standBy: boolean;
  outposts: string[];
  claimRooms: string[];
  stats: { [key: string]: number };
}

const DEFAULT_HUB_MEMORY = {
  bootstrap: false,
  standBy: false,
  outposts: [],
  claimRooms: [],
  stats: {}
} as HubMemory;


export enum RunActivity {
  LocalHarvest = 0x01,
  Outpost = 0x02,
  Upgrade = 0x04,
  Build = 0x08,
  Repair = 0x10,
  Miner = 0x20,
  Industry = 0x40,
  Explore = 0x80,
  Always = 0x100
}

export enum RunLevel {
  // Use all outpost resources
  BOOST = RunActivity.Always | RunActivity.LocalHarvest | RunActivity.Upgrade | RunActivity.Outpost | RunActivity.Build | RunActivity.Explore,
  // Use minimum room 
  NORMAL = RunActivity.Always | RunActivity.LocalHarvest | RunActivity.Upgrade | RunActivity.Build | RunActivity.Miner | RunActivity.Industry | RunActivity.Explore,
  // Use minimal activity
  // LIMITED = RunActivity.Always | RunActivity.LocalHarvest | RunActivity.Upgrade | RunActivity.Industry,
  // Minimal activity for energy
  MINIMAL = RunActivity.Always | RunActivity.LocalHarvest,
  // Minimal activity for energy and upgrade
  MINIMAL_UP = RunActivity.Always | RunActivity.LocalHarvest | RunActivity.Upgrade | RunActivity.Explore,
  // Disable the hub  
  STANDBY = RunActivity.Always
}


export class Hub {

  id: number;
  ref: string;

  name: string;

  memory: HubMemory;

  room: Room;
  outposts: Room[];
  rooms: Room[];

  pos: RoomPosition;

  dispatcher: Dispatcher;
  processStack: ProcessStack;
  logisticsNetwork: LogisticsNetwork;
  linkNetwork: LinkNetwork;

  runLevel: RunLevel;

  // Physical Hub structures and roomObjects
  controller: StructureController;					          // These are all duplicated from room properties
  spawns: StructureSpawn[];							              // |
  energyStructures: Structure[];                      // |
  storage?: StructureStorage;                         // |
  terminal?: StructureTerminal;                       // |

  structuresByRooms: Dictionary<Structure[]>;
  structures: Structure[];

  containers: StructureContainer[];
  containersByRooms: Dictionary<StructureContainer[]>;

  extentions: StructureExtension[];
  links: StructureLink[];
  labs: StructureLab[];
  towers: StructureTower[];
  nuker?: StructureNuker;

  constructionSitesByRooms: Dictionary<ConstructionSite[]>;
  constructionSites: ConstructionSite[];

  sources: Source[];
  minerals: Mineral[];

  drops: Resource[];
  dropsByRooms: { [roomName: string]: Resource[] };

  hostilesCreeps: Creep[];
  hostilesCreepsByRooms: Dictionary<Creep[]>;
  hostilesStructures: Structure[];
  hostilesStructuresByRooms: Dictionary<Structure[]>;

  areas: {
    agentFactory?: AgentFactoryArea,
    upgrade?: UpgradeArea,
    hubCenter?: HubCenterArea,
    minerals: MineralArea[]
  };

  areaList: Area[];

  private _agents: Agent[];										      // Creeps bound to the Hub, set by Commander
  private _agentsByRole?: Dictionary<Agent[]>;		  // Creeps hashed by their role name, set by Commander
  private _agentsByDaemon?: Dictionary<Agent[]>;	  // Creeps hashed by their overseer, set by Commander
  private _agentsByRoom?: Dictionary<Agent[]>;	    // Creeps hashed by their room, set by Commander


  roomPlanner: RoomPlanner;

  creepCPU: number;

  constructor(id: number, name: string, outposts: string[]) {
    this.id = id;
    this.name = name;
    this.ref = name;
    this.memory = Mem.wrap((Memory as any).hubs, name, DEFAULT_HUB_MEMORY, true);
    this.dispatcher = new Dispatcher(this);
    this.processStack = [];
    this.logisticsNetwork = new LogisticsNetwork(this);
    this.linkNetwork = new LinkNetwork(this);

    this.runLevel = RunLevel.NORMAL;

    this.structuresByRooms = {};
    this.structures = [];

    this.links = [];
    this.extentions = [];
    this.towers = [];
    this.labs = [];

    this.constructionSitesByRooms = {};
    this.constructionSites = [];

    this.sources = [];
    this.minerals = [];
    this.drops = []
    this.dropsByRooms = {};

    this.hostilesCreeps = [];

    this.areas = {
      minerals: []
    };
    this.areaList = [];

    this._agents = [];




    this.roomPlanner = new BunkerRoomPlanner(this);
    this.creepCPU = 0;

    this.build(outposts);
  }

  get print(): string {
    return '<a href="#!/room/' + Game.shard.name + '/' + (this.pos?.roomName ?? '??') + '">[' + this.name + ']</a>';
  }

  get level(): number {
    return this.controller.level;
  }

  get agents() {
    return this._agents;
  }

  set agents(value: Agent[]) {
    this._agents = value;
    // Invalid cache
    this._agentsByRole = undefined;
    this._agentsByDaemon = undefined;
    this._agentsByRoom = undefined;
  }

  get agentsByRole(): Dictionary<Agent[]> {
    if (!this._agentsByRole) {
      this._agentsByRole = _.groupBy(this.agents, agent => agent.memory.role);
    }
    return this._agentsByRole;
  }

  get agentsByDaemon(): Dictionary<Agent[]> {
    if (!this._agentsByDaemon) {
      this._agentsByDaemon = _.groupBy(this.agents, agent => agent.memory.daemon);
    }
    return this._agentsByDaemon;
  }

  get agentByRoom(): Dictionary<Agent[]> {
    if (!this._agentsByRoom) {
      this._agentsByRoom = _.groupBy(this.agents, agent => agent.room.name);
    }
    return this._agentsByRoom;
  }

  haveActivity(activityMask: number): boolean {
    return ((this.runLevel as number) & activityMask) > 0;
  }

  private registerRoomObject() {
    const outputNames = _.map(this.rooms, room => room.name);

    this.controller = this.room.controller!;
    this.storage = this.room.storage;
    this.spawns = _.filter(Game.spawns, spawn => spawn.room.name === this.name);
    this.pos = (this.storage || this.spawns[0] || this.controller).pos;

    this.structuresByRooms = _.reduce(this.rooms, (acc, room) => {
      //acc[room.name] = _.remove(room.find(FIND_STRUCTURES) as Structure[], structure => structure.id == this.controller.id);
      acc[room.name] = room.find(FIND_STRUCTURES) as Structure[];
      return acc;
    }, {} as Dictionary<Structure[]>);
    this.structures = _.flatten(_.values(this.structuresByRooms));

    this.containers = _.filter(this.structures, structure => structure.structureType == STRUCTURE_CONTAINER) as StructureContainer[];
    this.containersByRooms = _.groupBy(this.containers, container => container.room.name);

    this.extentions = _.filter(this.structuresByRooms[this.room.name] ?? [], structure => structure.structureType == STRUCTURE_EXTENSION) as StructureExtension[];
    this.links = _.filter(this.structuresByRooms[this.room.name] ?? [], structure => structure.structureType == STRUCTURE_LINK) as StructureLink[];
    this.towers = _.filter(this.structuresByRooms[this.room.name] ?? [], structure => structure.structureType == STRUCTURE_TOWER) as StructureTower[];

    this.labs = _.filter(this.structuresByRooms[this.room.name] ?? [], structure => structure.structureType == STRUCTURE_LAB) as StructureLab[];
    this.nuker = _.find(this.structuresByRooms[this.room.name] ?? [], structure => structure.structureType == STRUCTURE_NUKER) as StructureNuker | undefined;

    this.constructionSites = _.filter(Game.constructionSites, site => outputNames.includes(site.pos.roomName));
    this.constructionSitesByRooms = _.groupBy(this.constructionSites, site => site.pos.roomName);

    this.sources = _.chain(this.rooms)//
      .map(room => room.find(FIND_SOURCES))//
      .flatten()//
      .orderBy(source => getMultiRoomRange(source.pos, this.pos), ['asc'])//
      // .slice(0, Settings.hubMaxSource(this.level))//
      .value();

    this.sources.forEach(source => setHarvestFlag(this, source));

    this.minerals = this.room.find(FIND_MINERALS);

    this.dropsByRooms = {};
    this.rooms.forEach(room => {
      this.dropsByRooms[room.name] = room.find(FIND_DROPPED_RESOURCES);
    });
    this.drops = _.flatten(_.values(this.dropsByRooms));

    this.hostilesCreeps = _.flatten(_.map(this.rooms, room => room.find(FIND_HOSTILE_CREEPS)));
    this.hostilesCreepsByRooms = _.groupBy(this.hostilesCreeps, creep => creep.room.name);
    this.hostilesStructures = _.flatten(_.map(this.rooms, room => room.find(FIND_HOSTILE_STRUCTURES)));
    this.hostilesStructuresByRooms = _.groupBy(this.hostilesStructures, structure => structure.room.name);
  }

  private build(outposts: string[]) {

    this.room = Game.rooms[this.name];
    this.outposts = _.compact(_.map(outposts, outpost => Game.rooms[outpost]));
    this.rooms = [this.room].concat(this.outposts);
    this.registerRoomObject();

    if (this.spawns[0]) {
      this.areas.agentFactory = new AgentFactoryArea(this, this.spawns[0]);
    }

    if (this.storage && this.spawns[0]) {
      this.areas.hubCenter = new HubCenterArea(this, this.storage);
    }

    if (this.level >= 6) {
      this.areas.minerals = this.minerals.map(mineral => new MineralArea(this, mineral));
    }

    this.areas.upgrade = new UpgradeArea(this);

    this.areaList = _.flatten(_.values(this.areas) as (Area | Area[])[]);
    this.areaList.forEach(area => area.registerDaemons());

    this.roomPlanner.refresh();

  }

  getAreaReport(): { data: string[][], styles: TextStyle[] } {

    // const roledata: string[][] = [];
    const styles: TextStyle[] = [];

    const roledata: string[][] = _.chain(this.areaList)//
      .orderBy(area => Math.max(area.performanceReport['init'] ?? 0, area.performanceReport['run'] ?? 0), ['desc'])//
      .map(area => [`${area.name}@${area.pos.roomName}`, `${area.performanceReport['init'] ?? '---'} ${area.performanceReport['run'] ?? '---'}`])//
      .value();

    const total = _.reduce(this.areaList, (acc, area) => [acc[0] + (area.performanceReport['init'] ?? 0), acc[1] + (area.performanceReport['run'] ?? 0)], [0, 0]);

    roledata.push(['TOTAL', `${Math.round(total[0] * 100 + Number.EPSILON) / 100} + ${Math.round(total[1] * 100 + Number.EPSILON) / 100} = ${Math.round((total[0] + total[1]) * 100 + Number.EPSILON) / 100}`]);

    /*
  for (const daemon of this.daemons) {
    roledata.push([`${daemon.name}@${daemon.pos.roomName}`, `  ${daemon.agents.length} - ${daemon.performanceReport['init'] ?? '---'} ${daemon.performanceReport['run'] ?? '---'}`]);
    styles.push({});
  }
  */

    return { data: roledata, styles: styles };
  }

  private drawCPUReport(coord: Coord): Coord {
    let { x, y } = coord;
    const roledata = [
      ['CPU creeps', `${Math.floor(this.creepCPU * 100 + Number.EPSILON) / 100}`],
      ['CPU total', `${Math.floor(Game.cpu.getUsed() * 100 + Number.EPSILON) / 100}`],
    ];
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.infoBox(`${this.name} CPU`, roledata, tablePos, 12);
    return { x, y };
  }

  private drawAgentReport(coord: Coord): Coord {
    let { x, y } = coord;
    const roledata = this.dispatcher.getAgentReport();
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.infoBox(`${this.name} Agents [${this.agents.length}]`, roledata, tablePos, 12);
    return { x, y };
  }

  private drawAreaReport(coord: Coord): Coord {
    let { x, y } = coord;
    const report = this.getAreaReport();
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.infoBox(`${this.name} Areas [${this.areaList.length}]`, report.data, tablePos, 12);
    return { x, y };
  }

  private drawDirectiveReport(coord: Coord): Coord {
    let { x, y } = coord;
    const report = this.dispatcher.getDirectiveReport();
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.infoBox(`${this.name} Directives [${this.dispatcher.directives.length}]`, report.data, tablePos, 12);
    return { x, y };
  }

  private drawDaemonReport(coord: Coord): Coord {
    let { x, y } = coord;
    const report = this.dispatcher.getDaemonReport();
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.infoBox(`${this.name} Daemons [${this.dispatcher.daemons.length}]`, report.data, tablePos, 12);
    return { x, y };
  }

  refresh() {

    const start = Game.cpu.getUsed();

    // Clear cache
    this._agentsByRole = undefined;
    this._agentsByDaemon = undefined;

    this.room = Game.rooms[this.name];
    this.outposts = _.compact(_.map(this.memory.outposts, outpost => Game.rooms[outpost]));
    this.rooms = [this.room].concat(this.outposts);

    this.registerRoomObject();
    this.logisticsNetwork.refresh();
    this.linkNetwork.refresh();

    this.areaList.forEach(area => pushProcess(this.processStack, () => {
      area.refresh();
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.areaPriotityOffset));
    this.dispatcher.refresh();

    this.roomPlanner.refresh();

    log.debug(`${this.print} refresh cost : ${Math.floor((Game.cpu.getUsed() - start) * 100) / 100}`)

  }

  init() {

    this.creepCPU = 0;

    /**
     * Enable/Disable daemons
     */
    _.forIn(RunActivity, (activity, key) => {
      if (isNaN(Number(key))) {

        if ((this.runLevel & activity) == 0) {
          _.forEach(this.dispatcher.daemonsByActivity[activity], daemon => {
            this.dispatcher.suspendDaemon(daemon, 100);
          });
        }

      }
    });

    /**
     * Run sub process
     */

    this.areaList.forEach(area => pushProcess(this.processStack, () => {
      const start = Game.cpu.getUsed();
      area.init();
      const cpuCost = Game.cpu.getUsed() - start;
      area.performanceReport['init'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.areaPriotityOffset + 10));
    this.dispatcher.init();

    /**
     * Set all drops not registered as resource
     */
    pushProcess(this.processStack, () => {
      this.drops.forEach(drop => {
        if (!this.logisticsNetwork.haveRequest(drop, drop.resourceType)) {
          this.logisticsNetwork.requestOutput(drop, drop.resourceType);
        }
      });
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.areaPriotityOffset + 10);

    pushProcess(this.processStack, () => this.roomPlanner.init());

  }

  run() {

    const start = Game.cpu.getUsed();

    this.areaList.forEach(area => pushProcess(this.processStack, () => {
      const start = Game.cpu.getUsed();
      const cpuCost = Game.cpu.getUsed() - start;
      area.performanceReport['run'] = Math.round((cpuCost + Number.EPSILON) * 100) / 100;
      area.run();
    }, PROCESS_PRIORITY_HIGHT + Dispatcher.Settings.areaPriotityOffset + 20));

    this.dispatcher.run();

    pushProcess(this.processStack, () => this.linkNetwork.run(), PROCESS_PRIORITY_HIGHT + 30);

    // Run agent
    _.orderBy(this.agents, agent => agent.lastRunTick, ['asc']).forEach(agent => pushProcess(this.processStack, () => {
      const start = Game.cpu.getUsed();
      agent.run(this);
      const timeElasped = Game.cpu.getUsed() - start;
      this.creepCPU += timeElasped;
    }, PROCESS_PRIORITY_NORMAL));

    // Run room planner
    pushProcess(this.processStack, () => this.roomPlanner.run(), PROCESS_PRIORITY_LOW);

    log.info(`HUB::run() CPU used : ${Game.cpu.getUsed() - start}`)

  }

  visuals() {

    Game.map.visual.circle(this.pos, { fill: 'transparent', radius: 1.5 * 50, stroke: '#ff0000' });
    // Game.map.visual.circle(nuker.pos, { fill: 'transparent', radius: NUKE_RANGE * 50, stroke: '#ff0000' });

    let x = 1;
    let y = 8;
    let coord: Coord;

    coord = this.drawCPUReport({ x, y });
    x = coord.x;
    y = coord.y;

    coord = this.drawAgentReport({ x, y });
    x = coord.x;
    y = coord.y;

    coord = this.drawDirectiveReport({ x, y });
    x = coord.x;
    y = coord.y;

    coord = this.drawAreaReport({ x, y });
    x = coord.x;
    y = coord.y;

    coord = this.drawDaemonReport({ x, y });
    x = coord.x;
    y = coord.y;

  }

}