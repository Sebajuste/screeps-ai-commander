import { Task } from "./Task";
import { AttackTask } from "./tasks/AttackTask";
import { BuildTask } from "./tasks/BuildTask";
import { DropTask } from "./tasks/DropTask";
import { HarvestTask } from "./tasks/HarvestTask";
import { PickupTask } from "./tasks/PickupTask";
import { RepairTask } from "./tasks/RepairTask";
import { ReserveTask } from "./tasks/ReserveTask";
import { SignTask } from "./tasks/SignTask";
import { TransferTask } from "./tasks/TransferTask";
import { UpgradeTask } from "./tasks/UpgradeTask";
import { WaitTask } from "./tasks/WaitTask";
import { WithdrawTask } from "./tasks/WithdrawTask";

export type StoreStructure = StructureContainer | StructureStorage | StructureLink | StructureTerminal | StructureLab | StructureTower | StructureSpawn;

export type EnergyStructure = StructureLink | StructureSpawn | StructureLab | StructureTower | StructureExtension;

export type WithdrawTarget = StoreStructure | Ruin | Tombstone;

export function isIdObject(object: any): object is _HasId {
  return (<_HasId>object).id != undefined;
}

export function isEnergyStructure(structure: Structure): structure is EnergyStructure {
  return (<EnergyStructure>structure).energy != undefined && (<EnergyStructure>structure).energyCapacity != undefined;
}

export function isStoreStructure(obj: RoomObject): obj is StoreStructure {
  return (<StoreStructure>obj).store != undefined;
}

export function isTombstone(obj: RoomObject): obj is Tombstone {
  return (<Tombstone>obj).deathTime != undefined;
}

export function isResource(obj: RoomObject): obj is Resource {
  return (<Resource>obj).amount != undefined;
}

export function isTargetPosition(obj: RoomObject | _HasRoomPosition): obj is _HasRoomPosition {
  return (<_HasRoomPosition>obj).pos != undefined && Object.keys(obj).length == 1 && isRoomPosition(obj.pos);
}

export function isRoomPosition(obj: any): obj is RoomPosition {
  return (<RoomPosition>obj).x != undefined && (<RoomPosition>obj).y != undefined && (<RoomPosition>obj).roomName != undefined;
}


export class Tasks {

  static attack(target: AnyCreep | Structure<StructureConstant>) {
    return new AttackTask(target);
  }

  static build(target: ConstructionSite) {
    return new BuildTask(target);
  }

  static drop(pos: RoomPosition, resourceType: ResourceConstant): Task {
    return new DropTask(pos, resourceType);
  }

  static harvest(target: Source | Mineral<MineralConstant> | Deposit, container?: StoreStructure | null): Task {
    return new HarvestTask(target, container);
  }

  static pickup(resource: Resource<ResourceConstant>): Task {
    return new PickupTask(resource);
  }

  static repair(target: Structure) {
    return new RepairTask(target);
  }

  static reserve(target: StructureController) {
    return new ReserveTask(target);
  }

  static sign(controller: StructureController, text: string) {
    return new SignTask(controller, text);
  }

  static transfer(target: StoreStructure, resourceType: ResourceConstant): Task {
    return new TransferTask(target, resourceType);
  }

  static upgrade(target: StructureController): Task {
    return new UpgradeTask(target);
  }

  static wait(pos: RoomPosition, targetRange?: number) {
    return new WaitTask(pos, targetRange);
  }

  static withdraw(target: StoreStructure | Tombstone, resourceType: ResourceConstant): Task {
    return new WithdrawTask(target, resourceType);
  }

}