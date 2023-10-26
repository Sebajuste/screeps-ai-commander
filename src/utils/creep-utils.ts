
export function printCreep(creep: Creep) {
  return `<a href="#!/room/${Game.shard.name}/${creep.pos.roomName}">[${creep.name}@${creep.pos.roomName},x:${creep.pos.x},y:${creep.pos.y}]</a>`;
}
