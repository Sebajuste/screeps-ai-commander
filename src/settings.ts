import _ from "lodash";

export const Settings = {

  profilerEnable: true,
  rebuildTick: 500,
  cpuMax: 17, // Game.cpu.limit * 0.85, // 17 per hub

  cpuBucketMin: 400,

  hubOutpostAmount: 2,
  hubMaxSource: (rcl: number) => Math.max(2, rcl < 4 ? 5 : 4),


  hubStorageMaxEnergy: 200000,

  Username: _.first(_.filter(_.values(Game.structures), (structure: any) => structure['owner'] != undefined) as any[]).owner.username

};