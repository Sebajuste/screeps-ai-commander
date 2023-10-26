import _ from "lodash";

export const Settings = {

  profilerEnable: true,
  rebuildTick: 500,
  cpuMax: Game.cpu.limit * 0.85, // 17

  cpuBucketMin: 400,

  hubOutpostAmount: 2,
  hubMaxSource: 5,

  Username: _.first(_.filter(_.values(Game.structures), (structure: any) => structure['owner'] != undefined) as any[]).owner.username

};