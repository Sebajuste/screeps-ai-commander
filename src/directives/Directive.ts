import _ from "lodash";

import { Commander } from "Commander";
import { Hub, RunActivity } from "hub/Hub";
import { Actor, ResourceFlowStats } from "Actor";
import { Coord } from "utils/coord";
import { log } from "utils/log";
import { Daemon } from "daemons/daemon";

export const FLAG_NAME_REGEX = /([\w]*)(@([\w]*))?\/([\w]*)/

export abstract class Directive implements Actor {

    name: string;
    ref: string;
    hub: Hub;
    room: Room;
    pos: RoomPosition; 							// Flag position
    memory: FlagMemory;
    performanceReport: { [stat: string]: number };

    commander: Commander;
    flag: Flag;
    daemons: { [name: string]: Daemon };	    // Daemons
    resourceFlowStats: ResourceFlowStats;


    constructor(commander: Commander, flag: Flag, hub: Hub, includePos = false) {
        if (!flag) log.error("No flag to create Directive")
        if (!hub) log.error("No Colony to create Directive")
        this.name = flag.name;
        this.ref = includePos ? `${flag.name}@${flag.pos.roomName}` : `${flag.name}@${hub.name}`;
        this.hub = hub;
        this.room = flag.room!;
        this.pos = flag.pos;
        this.commander = commander;
        this.flag = flag;
        this.memory = flag.memory;
        this.daemons = {};
        this.performanceReport = {};
        this.resourceFlowStats = new ResourceFlowStats();

        if (!this.room) {
            throw new Error(`Invalid flag room for $${flag.name}`);
        }
    }

    get print(): string {
        return `<a href="#!/room/${Game.shard.name}/${this.pos.roomName}">[${this.name}@${this.room.name}]</a>`;
    }

    static getFlag(pos: RoomPosition, name?: string): Flag | null {
        for (const flagName in Game.flags) {
            const flag = Game.flags[flagName];
            if (flag.pos.roomName == pos.roomName && flag.pos.x == pos.x && flag.pos.y == pos.y && (!name || flag.name.includes(name))) {
                return flag;
            }
        }
        return null;
    }

    static isPresent(pos: RoomPosition, name?: string): boolean {
        for (const flagName in Game.flags) {
            const flag = Game.flags[flagName];
            if (flag.pos.roomName == pos.roomName && flag.pos.x == pos.x && flag.pos.y == pos.y && (!name || flag.name.includes(name))) {
                return true;
            }
        }
        return false;
    }

    static createFlagIfNotPresent(pos: RoomPosition, name: string, color: ColorConstant = COLOR_WHITE): ERR_INVALID_TARGET | ERR_NAME_EXISTS | ERR_INVALID_ARGS | string {
        if (!this.isPresent(pos, name)) {
            return pos.createFlag(`${name}@${pos.roomName}/${Math.floor(Math.random() * 0xffff)}`, color, color);
        }
        return ERR_INVALID_TARGET;
    }

    static removeFlagIfPresent(pos: RoomPosition, name: string): number {
        const flag = this.getFlag(pos, name); // _.find(pos.lookFor(LOOK_FLAGS), flag => flag.name.includes('bootstrap'));
        if (flag) {
            return flag.remove();
        }
        return ERR_INVALID_TARGET;
    }

    static isDirective(flag: Flag, name: string): boolean {
        const r = FLAG_NAME_REGEX.exec(flag.name);
        if (r) return r[1] == name;
        return false;
    }

    registerDaemons() {
        this.spawnDaemons();
        _.values(this.daemons).forEach(daemon => this.hub.dispatcher.registerDaemon(daemon));
    }

    remove() {
        _.values(this.daemons).forEach(daemon => this.hub.dispatcher.removeDaemon(daemon));
        this.commander.removeDirective(this);
        if (this.flag) {
            // check in case flag was removed manually in last build cycle
            return this.flag.remove();
        }
    }

    refresh() {
        const flag = Game.flags[this.flag.name];
        if (!flag) {
            log.warning(`Missing flag for directive ${this.print}! Removing directive.`);
            this.remove();
            return;
        }
        this.memory = this.flag.memory;
        this.pos = flag.pos;
        this.resourceFlowStats.clear();
    }

    abstract spawnDaemons(): void;

    /* Initialization logic goes here, called in overseer.init() */
    abstract init(): void;

    /* Runtime logic goes here, called in overseer.run() */
    abstract run(): void;

    visuals(coord: Coord): Coord {
        return coord;
    }

}
