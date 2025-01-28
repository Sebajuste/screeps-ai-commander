import _ from "lodash";
import { Mem } from "memory/Memory";

const DEFAULT_SETTINGS = {

  guiEnabled: false,

  generatePixel: true,
  creepMaxTaskRun: 4,

  profilerEnabled: true,
  rebuildTick: 500,
  cpuMax: Game.cpu.limit * 0.85, // 17 per hub

  cpuBucketMin: 400,
  cpuLimitBucket: 2000,
  cpuUnlimitBucket: 5000,

  hubMinTickCPU: 10,
  hubMinimalBucket: 1500,

  hubMaxHauler: 6,
  hubOutpostAmount: 3,
  hubMaxSource: (rcl: number) => {
    switch (rcl) {
      case 4: return 5;
      case 5: return 4;
      case 6: return 4;
      case 7: return 3;
      case 8: return 2;
      default:
        return Math.max(2, rcl < 4 ? 6 : 5);
    }
  },

  hubStorageMinEnergy: 10000,
  hubStorageMaxEnergy: 200000,
  hubStorageMaxResource: 50000,

  hubCenterMinLinkEnergy: 300,
  hubTerminalEnergy: 10000,

  upgradeMinLinkEnergy: 500,
  /**
   * Minimum energy require to fill upgrade
   */
  upgradeMinStorageEnergy: 10000,

  Username: _.first(_.filter(_.values(Game.structures), (structure: any) => structure['owner'] != undefined) as any[]).owner.username

};

export const Settings: { [key: string]: any } = Mem.wrap(Memory, 'settings', DEFAULT_SETTINGS);