import { Commander } from "Commander";
import { Hub } from "hub/Hub";
import { Directive } from "directives/Directive";
import _ from "lodash";
import { DefendDaemon } from "daemons/military/defend-daemon";
import { ReserveDaemon } from "daemons/expend/reserve-daemon";


export interface OutpostMemory {
    analysed?: boolean;
}

/**
 * Secure an outpost
 */
export class OutpostDirective extends Directive {

    memory: OutpostMemory;

    daemons: {
        defend: DefendDaemon,
        reserve?: ReserveDaemon
    };

    constructor(commander: Commander, flag: Flag, hub: Hub) {
        super(commander, flag, hub);
        this.memory = flag.memory as OutpostMemory;
    }

    static filter(flag: Flag): boolean {
        return Directive.isDirective(flag, 'outpost');
    }

    spawnDaemons(): void {
        this.daemons.defend = new DefendDaemon(this.hub, this);
        if (this.hub.level > 4) {
            this.daemons.reserve = new ReserveDaemon(this.hub, this);
        }
    }

    init(): void {

    }

    run(): void {

    }

}