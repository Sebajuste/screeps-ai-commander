import _ from "lodash";

interface MemCacheMemory<T> {
  cache?: T;
}

export class MemCache<T, S = T> {

  protected memory: MemCacheMemory<S>;

  protected _value?: T;

  protected name: string;

  constructor(memory: any, name: string, defaults: any = {}) {
    this.name = name;
    this.memory = Mem.wrap(memory, name, defaults);
  }

  protected deserialize(): T | null {
    return this.memory.cache as any;
  }

  protected serialize(value: T): S {
    return value as any;
  }

  clear() {
    this._value = undefined
    delete this.memory['cache'];
  }

  get value(): T | null {
    if (!this._value && this.memory.cache) {
      const obj = this.deserialize();
      if (obj) {
        this._value = obj as T;
      } else {
        this.clear();
      }
    }
    return this._value ?? null;
  }

  set value(v: T | null) {
    if (v) {
      this._value = v;
      this.memory.cache = this.serialize(v);
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
    return this.memory.cache ? Game.getObjectById(this.memory.cache) as T : null;
  }

  protected serialize(value: T): Id<_HasId> {
    return value.id;
  }

  refresh(memory: any) {
    this.memory = Mem.wrap(memory, this.name, {});
    this._value = undefined;
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

