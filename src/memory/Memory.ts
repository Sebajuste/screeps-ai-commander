import _ from "lodash";

interface MemCacheMemory<T> {
  data?: T;
}

export class MemCache<T, S = T> {

  protected memory: MemCacheMemory<S>;

  protected _cache?: T;

  protected name: string;

  constructor(memory: any, name: string, defaults: any = {}) {
    this.name = name;
    this.memory = Mem.wrap(memory, name, defaults);
  }

  protected deserialize(): T | null {
    return this.memory.data as any;
  }

  protected serialize(value: T): S {
    return value as any;
  }

  isValid(): boolean {
    return this._cache != null && this.value != undefined;
  }

  clear() {
    this._cache = undefined
    delete this.memory['data'];
  }

  get value(): T | null {
    if (!this._cache && this.memory.data) {
      // Update cache from memory
      const obj = this.deserialize();
      if (obj) {
        this._cache = obj as T;
      } else {
        this.clear();
      }
    }
    if (this._cache && !this.memory.data) {
      // Save cache into memory
      this.memory.data = this.serialize(this._cache);
    }
    return this._cache ?? null;
  }

  set value(v: T | null) {
    if (v) {
      this._cache = v;
      this.memory.data = this.serialize(v);
    } else {
      this.clear();
    }
  }

}

export class MemCacheObject<T extends _HasId> extends MemCache<T, Id<_HasId>> {

  protected memory: MemCacheMemory<Id<_HasId>>

  constructor(memory: any, name: string) {
    super(memory, name);
  }

  protected deserialize(): T | null {
    const value = this.memory.data ? Game.getObjectById(this.memory.data) as T : null;
    if (!value) {
      this.clear();
    }
    return value;
  }

  protected serialize(value: T): Id<_HasId> {
    return value.id;
  }

  refresh(memory: any) {
    this.memory = Mem.wrap(memory, this.name, {});
    this._cache = undefined;
  }

}


export class Mem {

  static init() {
    const memory: any = Memory;
    if (!memory['creeps']) {
      memory['creeps'] = {};
    }
    if (!memory['flags']) {
      memory['flags'] = {};
    }
    if (!memory['rooms']) {
      memory['rooms'] = {};
    }
    /*
    if (!memory['spawns']) {
        memory['spawns'] = {};
    }
    */
    if (!memory['colonies']) {
      memory['colonies'] = {};
    }
  }

  static wrap(memory: any, name: string, defaults: any = {}, deep = false): any {
    if (!memory[name]) {
      memory[name] = _.clone(defaults);
    }
    if (deep) {
      _.defaultsDeep(memory[name], defaults);
    } else {
      _.defaults(memory[name], defaults);
    }
    return memory[name];
  }

}

