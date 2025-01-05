import { RandomSeeded } from "./random-seeded";

const prefixes = [
  "Auto", "Neo", "Cyber", "Mecha", "Robo", "Tech", "Nano", "Quantum",
  "Aero", "Hydro", "Electro", "Plasma", "Proto", "Magna", "Meta", "Cryo"
];

const bases = [
  "tron", "node", "forge", "grid", "plex", "sphere", "core", "prime",
  "byte", "chip", "drive", "pulse", "beam", "cog", "link", "array",
  "servo", "module", "crank", "unit", "matrix", "delta", "flux", "crux"
];

const suffixes = [
  "X", "Z", "IX", "V2", "9000", "Alpha", "Beta", "Gamma",
  "Omega", "Prime", "Core", "Zero", "One", "Infinity", "Nova", "Spark",
  "Blade", "Edge", "Shift", "Claw", "Hammer", "Storm", "Star", "Forge"
];

function hashRoomName(roomName: string): number {
  let hash = 0;
  for (let i = 0; i < roomName.length; i++) {
      const char = roomName.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Forcer en 32 bits
  }
  return Math.abs(hash);
}

export function generateRandomName(seed: number): string {
  const random = new RandomSeeded(seed);

  // Sélectionner aléatoirement un préfix, une base, et un suffix
  const prefix = prefixes[random.randomInt(0, prefixes.length - 1)];
  const base = bases[random.randomInt(0, bases.length - 1)];
  const suffix = suffixes[random.randomInt(0, suffixes.length - 1)];

  // Assembler le nom
  return `${prefix}${base} ${suffix}`;
}

export function getSeedFromRoomName(roomName: string): number {
  const match = /^([EW])(\d+)([NS])(\d+)$/.exec(roomName);
  if (!match) throw new Error("Invalid room name format");

  const [_, ew, x, ns, y] = match;

  const xCoord = (ew === "E" ? 1 : -1) * parseInt(x, 10);
  const yCoord = (ns === "N" ? 1 : -1) * parseInt(y, 10);

  // Combiner les coordonnées pour former une chaîne unique
  const combinedString = `${xCoord},${yCoord}`;

  // Hash simple pour obtenir un seed
  return hashRoomName(combinedString);
}

