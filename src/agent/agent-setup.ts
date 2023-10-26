import { BodyTemplate, CreepSetup } from "./agent-builder";



export const AGENT_PRIORITIES = {
    bootstrap: 1,
    commander: 1,
    harvester: 10,
    hauler: 10,
    supplier: 15,
    guard: 20,
    upgrader_earlier: 25,
    probe: 35,
    builder: 45,
    commando: 47,
    miner: 50,
    miner_hauler: 50,
    upgrader: 55,
    claimer: 70,
    claimer_builder: 71,
    claimer_harvester: 72,
    reserver: 80,
}

export const BUIDER_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [WORK, CARRY, MOVE, MOVE],
        [WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
        [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
    ]
}

export const COMMANDER_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY], // 8-CARRY
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY], // 16-CARRY
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY] // 32-CARRY
    ]
}

export const COMMANDO_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [MOVE, ATTACK],
        [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK],
        [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]
    ]
};

export const EARLIER_TEMPLATE: BodyTemplate = {
    bodyParts: [[WORK, CARRY, MOVE]]
};


export const HAULER_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [CARRY, CARRY, MOVE, MOVE], // 2-CARRY 2-MOVE
        [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 3-CARRY 3-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 6-CARRY 3-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 8-CARRY 4-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 16-CARRY 6-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 16-CARRY 8-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 32-CARRY 16-MOVE
    ]
}

export const HARVEST_BASIC_STRUCTURE_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [WORK, WORK, MOVE],
        [WORK, WORK, WORK, MOVE],
        [WORK, WORK, WORK, WORK, MOVE],
        [WORK, WORK, WORK, WORK, WORK, MOVE], // 5-WORK 1-MOVE
    ]
};

export const HARVEST_STRUCTURE_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [WORK, WORK, MOVE],
        [WORK, WORK, CARRY, MOVE],
        [WORK, WORK, WORK, CARRY, MOVE],
        [WORK, WORK, WORK, WORK, CARRY, MOVE], // 5-WORK 1-CARRY 1-MOVE
        // [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
        // [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
        // [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE] // 8-WORK 4-CARRY 3-MOVE
    ]
};

export const HEALER_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [HEAL, HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, HEAL,
            MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL,
            HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, HEAL,
            HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, HEAL, HEAL, MOVE, HEAL, MOVE] // 38-HEAL, 12-MOVE

    ]
}

export const SUPPLY_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], // 4-CARRY 2-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 8-CARRY 4-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 16-CARRY 8-MOVE
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] // 32-CARRY 16-MOVE
    ]
}

export const UPGRADER_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [WORK, CARRY, MOVE],
        [WORK, CARRY, CARRY, MOVE, MOVE], // 1-WORK 2-CARRY 2-MOVE
        [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE], // 5-WORK 1-CARRY 3-MOVE
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 10-WORK 2-CARRY 6-MOVE
    ]
};

export const UPGRADER_BATTERY_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [WORK, WORK, CARRY, MOVE],  // 2-WORK 1-CARRY 1-MOVE
        [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE], // 5-WORK 1-CARRY 3-MOVE
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE], // 7-WORK 1-CARRY 3-MOVE
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE], // 8-WORK 1-CARRY 4-MOVE
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 10-WORK 2-CARRY 6-MOVE
    ]
};

export const UPGRADER_BOOST_TEMPLATE: BodyTemplate = {
    bodyParts: [
        [WORK, CARRY, MOVE],
        [WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 8-WORK 8-CARRY 8-MOVE
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 16-WORK 8-CARRY 8-MOVE
        [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 16-WORK 16-CARRY 16-MOVE
    ]
};