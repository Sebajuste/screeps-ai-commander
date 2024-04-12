import _ from "lodash";


export interface EconomicInput {
  consumption: number;
  income: number;
}

export class EconomicStat {

  private _stats: Record<string, EconomicInput>;

  constructor(copy?: EconomicStat) {
    this._stats = copy ? _.cloneDeep(copy._stats) : {};
  }

  private getOrCreate(resource: ResourceConstant): EconomicInput {
    if (!this._stats[resource]) {
      this._stats[resource] = { consumption: 0, income: 0 }
    }
    return this._stats[resource]
  }

  clear() {
    this._stats = {};
  }

  getStat(resource: ResourceConstant): EconomicInput {
    return this.getOrCreate(resource);
  };

  addConsumption(resource: ResourceConstant, value: number) {
    const stats = this.getOrCreate(resource);
    stats.consumption += value;
  }

  addIncome(resource: ResourceConstant, value: number) {
    const stats = this.getOrCreate(resource);
    stats.income += value;
  }

  concat(other: EconomicStat): EconomicStat {
    const result = new EconomicStat(this);
    // _.mergeWith(result._stats, other._stats, (obj, src) => obj);
    return result;
  }

}