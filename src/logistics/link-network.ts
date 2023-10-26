
import { Hub } from "hub/Hub";
import _ from "lodash";


export class LinkNetwork {

  hub: Hub;

  private _inputs: StructureLink[];
  private _outputs: StructureLink[];

  constructor(hub: Hub) {
    this.hub = hub;
    this._inputs = [];
    this._outputs = [];
  }

  get print(): string {
    return `<a href="!/room/${Game.shard.name}/${this.hub.pos.roomName}">[${this.hub.name} LinkNetwork]</a>`
  }

  requestInput(link: StructureLink) {

    if (link.store.getFreeCapacity(RESOURCE_ENERGY) < 10) return;

    this._inputs.push(link);
  }

  requestOutput(link: StructureLink) {

    if (link.store.getUsedCapacity(RESOURCE_ENERGY) == 0) return;

    this._outputs.push(link);
  }

  refresh() {
    this._inputs = [];
    this._outputs = [];
  }

  run() {

    if (this._inputs.length == 0 || this._outputs.length == 0) {
      // No enough request to run the network
      return;
    }

    const inputs = _.orderBy(this._inputs, input => input.store.getUsedCapacity(RESOURCE_ENERGY), ['asc']);

    inputs.forEach(inputLink => {

      const outputLink = inputLink.pos.findClosestByRange(this._outputs, { filter: (output: StructureLink) => output.cooldown == 0 });

      if (outputLink) {
        const amount = Math.min(inputLink.store.getFreeCapacity(RESOURCE_ENERGY), outputLink.store.getUsedCapacity(RESOURCE_ENERGY));
        if (amount > 10) {
          outputLink.transferEnergy(inputLink, amount);
          _.remove(this._outputs, link => link == outputLink);
        }
      }
    });


    if (this.hub.areas.hubCenter && this.hub.areas.hubCenter.link) {
      // Automatic transfer to the commander link
      const link = this.hub.areas.hubCenter.link;
      this._outputs.forEach(outputLink => {
        outputLink.transferEnergy(link);
      });
    }

  }

}