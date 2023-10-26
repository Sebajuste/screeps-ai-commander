import { CPU } from "cpu/CPU";
import { Mem } from "memory/Memory";
import { log } from "utils/log";
import { Scheduler } from "./Scheduler";
import { Agent } from "agent/Agent";
import { AgentFactoryArea } from "area/hub/agent-factory";
import { Area } from "area/Area";
import { getMultiRoomRange } from "utils/util-pos";
import { LogisticsNetwork } from "logistics/logistics-network";
import _, { Dictionary } from "lodash";
import { UpgradeArea } from "area/hub/upgrade-area";
import { PROCESS_PRIORITY_HIGHT, PROCESS_PRIORITY_LOW, PROCESS_PRIORITY_NORMAL } from "cpu/process";
import { Settings } from "settings";
import { setHarvestFlag } from "room/room-analyse";
import { RoomPlanner } from "./room-planner/room-planner";
import { BunkerRoomPlanner } from "./room-planner/bunker-room-planner";
import { Coord } from "utils/coord";
import { Visualizer } from "ui/visualizer";
import { HubCenterArea } from "area/hub/hubcenter-area";
import { LinkNetwork } from "logistics/link-network";


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


export class Hub {

  id: number;
  ref: string;

  name: string;

  memory: HubMemory;

  room: Room;
  outposts: Room[];
  rooms: Room[];

  pos: RoomPosition;

  scheduler: Scheduler;
  logisticsNetwork: LogisticsNetwork;
  linkNetwork: LinkNetwork;

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
  dropsByRooms: { [roomName: string]: Resource[] };

  hostilesCreeps: Creep[];
  hostilesCreepsByRooms: Dictionary<Creep[]>;
  hostilesStructures: Structure[];
  hostilesStructuresByRooms: Dictionary<Structure[]>;

  areas: {
    agentFactory?: AgentFactoryArea,
    upgrade?: UpgradeArea,
    hubCenter?: HubCenterArea
  };

  areaList: Area[];

  private _agents: Agent[];										                // Creeps bound to the Hub, set by Commander
  private _agentsByRole?: Dictionary<Agent[]>;		  // Creeps hashed by their role name, set by Commander
  private _agentsByDaemon?: Dictionary<Agent[]>;	  // Creeps hashed by their overseer, set by Commander


  roomPlanner: RoomPlanner;

  constructor(id: number, name: string, outposts: string[]) {
    this.id = id;
    this.name = name;
    this.ref = name;
    this.scheduler = new Scheduler(this);
    this.logisticsNetwork = new LogisticsNetwork(this);
    this.linkNetwork = new LinkNetwork(this);

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
    this.dropsByRooms = {};

    this.hostilesCreeps = [];

    this.areas = {};
    this.areaList = [];

    this._agents = [];

    const gameMemory: any = Memory;
    this.memory = Mem.wrap(gameMemory.hubs, name, DEFAULT_HUB_MEMORY, true);

    this.roomPlanner = new BunkerRoomPlanner(this);

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

  private registerRoomObject() {
    const outputNames = _.map(this.rooms, room => room.name);

    this.controller = this.room.controller!;
    this.storage = this.room.storage;
    this.spawns = _.filter(Game.spawns, spawn => spawn.room.name === this.name);
    this.pos = (this.storage || this.spawns[0] || this.controller).pos;

    this.structuresByRooms = _.reduce(this.rooms, (acc, room) => {
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

    this.sources = _.slice(_.orderBy(_.flatten(_.map(this.rooms, room => room.find(FIND_SOURCES))), source => getMultiRoomRange(source.pos, this.pos), ['asc']), 0, Settings.hubMaxSource(this.level));

    this.sources.forEach(source => setHarvestFlag(this, source));

    this.dropsByRooms = {};
    this.rooms.forEach(room => {
      this.dropsByRooms[room.name] = room.find(FIND_DROPPED_RESOURCES);
    });

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

    this.areas.upgrade = new UpgradeArea(this);

    this.areaList = _.flatten(_.values(this.areas) as (Area | Area[])[]);
    this.areaList.forEach(area => area.registerDaemons());

    this.roomPlanner.refresh();

  }

  private drawAgentReport(coord: Coord): Coord {
    let { x, y } = coord;
    const roledata = this.scheduler.getAgentReport();
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.info_box(`${this.name} Agents [${this.agents.length}]`, roledata, tablePos, 10);
    return { x, y };
  }

  private drawDaemonReport(coord: Coord): Coord {
    let { x, y } = coord;
    const report = this.scheduler.getDaemonReport();
    const tablePos = new RoomPosition(x, y, this.room.name);
    y = Visualizer.info_box(`${this.name} Daemons [${this.scheduler.daemons.length}]`, report.data, tablePos, 10);
    return { x, y };
  }

  refresh() {

    // Clear cache
    this._agentsByRole = undefined;
    this._agentsByDaemon = undefined;

    this.room = Game.rooms[this.name];
    this.outposts = _.compact(_.map(this.memory.outposts, outpost => Game.rooms[outpost]));
    this.rooms = [this.room].concat(this.outposts);

    this.registerRoomObject();
    this.logisticsNetwork.refresh();
    this.linkNetwork.refresh();

    this.areaList.forEach(area => CPU.cpu().pushProcess(() => area.refresh(), PROCESS_PRIORITY_HIGHT + Scheduler.Settings.areaPriotityOffset));
    this.scheduler.refresh();

    this.roomPlanner.refresh();
  }

  init() {

    this.areaList.forEach(area => CPU.cpu().pushProcess(() => area.init(), PROCESS_PRIORITY_HIGHT + Scheduler.Settings.areaPriotityOffset + 10));
    this.scheduler.init();

    CPU.cpu().pushProcess(() => this.roomPlanner.init());

  }

  run() {

    const start = Game.cpu.getUsed();

    this.areaList.forEach(area => CPU.cpu().pushProcess(() => area.run(), PROCESS_PRIORITY_HIGHT + Scheduler.Settings.areaPriotityOffset + 20));
    this.scheduler.run();

    CPU.cpu().pushProcess(() => this.linkNetwork.run(), PROCESS_PRIORITY_HIGHT + 30);


    _.orderBy(this.agents, agent => agent.lastRunTick, ['asc']).forEach(agent => CPU.cpu().pushProcess(() => agent.run(), PROCESS_PRIORITY_NORMAL));

    CPU.cpu().pushProcess(() => this.roomPlanner.run(), PROCESS_PRIORITY_LOW);

    log.info(`HUB::run() CPU used : ${Game.cpu.getUsed() - start}`)

  }

  visuals() {

    Game.map.visual.circle(this.pos, { fill: 'transparent', radius: 1.5 * 50, stroke: '#ff0000' });
    // Game.map.visual.circle(nuker.pos, { fill: 'transparent', radius: NUKE_RANGE * 50, stroke: '#ff0000' });

    let x = 1;
    let y = 8;
    let coord: Coord;

    coord = this.drawAgentReport({ x, y });
    x = coord.x;
    y = coord.y;

    coord = this.drawDaemonReport({ x, y });
    x = coord.x;
    y = coord.y;

  }

}