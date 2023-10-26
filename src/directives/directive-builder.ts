import { Commander } from "Commander";
import { Hub } from "hub/Hub";
import { Directive } from "./Directive";
import { OutpostDirective } from "./hub/outpost-directive";
import { log } from "utils/log";
import { EnergySourceDirective } from "./resources/energy-source-directive";
import { BuildDirective } from "./hub/build-directive";
import { ProbeDirective } from "./expend/probe-directive";


export const FLAG_NAME_REGEX = /([\w]*)(@([\w]*))?\/([\w]*)/



const CONFIG: { [name: string]: (commander: Commander, flag: Flag, hub: Hub) => Directive } = {
    "harvest": (commander: Commander, flag: Flag, hub: Hub) => new EnergySourceDirective(commander, flag, hub),
    // "bootstrap": (commander: Commander, flag: Flag, hub: Hub) => new BootstrapDirective(commander, flag, hub),
    "build": (commander: Commander, flag: Flag, hub: Hub) => new BuildDirective(commander, flag, hub),
    "scout": (commander: Commander, flag: Flag, hub: Hub) => new ProbeDirective(commander, flag, hub),
    "outpost": (commander: Commander, flag: Flag, hub: Hub) => new OutpostDirective(commander, flag, hub),
    "probe": (commander: Commander, flag: Flag, hub: Hub) => new ProbeDirective(commander, flag, hub),
    // "claim": (commander: Commander, flag: Flag, hub: Hub) => new ClaimDirective(commander, flag, hub),
    // "standBy": (commander: Commander, flag: Flag, hub: Hub) => new StandByDirective(commander, flag, hub),
}

export function createDirective(commander: Commander, flag: Flag, hub: Hub): Directive | null {
    const r = FLAG_NAME_REGEX.exec(flag.name);

    if (r) {
        const directive_name = r[1];
        if (CONFIG.hasOwnProperty(directive_name)) {
            const builder = CONFIG[directive_name];

            if (!hub) {
                log.error('Invalid hub to create directive')
                return null;
            }

            return builder(commander, flag, hub);
        } else {
            log.warning("Cannot found directive for flag ", flag.name);
        }
    } else {
        log.error('Invalid flag ', flag.name)
    }

    return null;
}

export function isDirective(flag: Flag, name: string): boolean {
    const r = FLAG_NAME_REGEX.exec(flag.name);
    if (r) return r[1] == name;
    return false;
}