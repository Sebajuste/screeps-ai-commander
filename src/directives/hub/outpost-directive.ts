import { Commander } from "Commander";
import { Hub } from "hub/Hub";
import { Directive } from "directives/Directive";
import _ from "lodash";
import { getMultiRoomRange } from "utils/util-pos";


export interface OutpostMemory {
    analysed?: boolean;
}

/**
 * Keep access and secure an outpost
 */
export class OutpostDirective extends Directive {

    memory: OutpostMemory;

    overseers: {
        // outpost: OutpostOverseer,
    };

    constructor(commander: Commander, flag: Flag, hub: Hub) {
        super(commander, flag, hub);
        this.memory = flag.memory as OutpostMemory;
    }

    static filter(flag: Flag): boolean {
        return Directive.isDirective(flag, 'outpost');
    }

    spawnDaemons(): void {
        // throw new Error("Method not implemented.");
    }

    init(): void {

    }

    run(): void {
        // (`OutpostDirective run ${this.name} - ${this.room}`)
    }

}