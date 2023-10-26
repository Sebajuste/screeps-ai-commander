import { Hub } from "hub/Hub";
import _ from "lodash";
import { Settings } from "settings";


export const SIGN_CONFIG: { [key: string]: string[] } = {

  hub: [
    "AI_Commander - ▲ Core Operations Room",
    "AI_Commander - ▼ Controlled Territory",
    "AI_Commander - ◆ Home Base Hub",
    "AI_Commander - ⇪ Sovereign Territory"
  ],
  outpost: [
    "AI_Commander - ◈ Outpost Expansion",
    "AI_Commander - ⇈ Remote Resource Hub",
    "AI_Commander - ▣ Outpost Node Secured"
  ],
  reserve: [
    "AI_Commander - ⇶ Future Base Prospects",
    "AI_Commander - ♺ Potential Expansion Site",
    "AI_Commander - ⊞ Forward Base Blueprint",
    "AI_Commander - ⤒ Expansion Nexus Planning",
    "AI_Commander - ⌇ Evolving Future Stronghold"
  ],
  attack: [
    "AI_Commander - ⚔ Frontline Monitoring",
    "AI_Commander - ☠ Enemy Encounters Detected",
    "AI_Commander - ⇛ Militarized Zone Patrol",
    "AI_Commander - ✴ Borderline Defense Watch",
    "AI_Commander - ⚑ Sentinel Forces Deployed"
  ],
  default: [
    "AI_Commander - ○ Uncharted Territory",
    "AI_Commander - ⇆ Scouting Unclaimed Land",
    "AI_Commander - ✈ Exploratory Reach",
    "AI_Commander - ≣ Uncharted Data Discovery"
  ]

};


export function selectSignText(type: string) {
  const group = SIGN_CONFIG[type] ?? SIGN_CONFIG.default;
  const index = Game.time % group.length;
  return group[index];
}

export function getSignFromRoom(hub: Hub, room: Room): string | undefined {
  const controller = room.controller;
  if (controller && (controller.sign?.username != Settings.Username || controller.sign?.text == '[object Object]' || controller.sign?.text == 'undefined')) {
    const isHub = room.name == hub.name;
    const isOutpost = _.find(hub.outposts, outpost => outpost.name == room.name) != undefined;
    const isEnnemy = !controller.my && controller.owner?.username !== Settings.Username;

    if (isHub) {
      return selectSignText('hub')
    } else if (isOutpost) {
      return selectSignText('outpost');
    } else if (isEnnemy) {
      return selectSignText('attack');
    } else {
      return selectSignText('default');
    }

  }
}