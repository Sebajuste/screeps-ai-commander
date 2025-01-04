
export class RandomSeeded {
  
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  // Génère un nombre pseudo-aléatoire entre 0 et 1
  private randomBits(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;
    const result = this.seed >>> 0; // entier non signé 32 bits
    this.seed++;
    return result;
  }

  random(): number {
    return this.randomBits() / 0xFFFFFFFF;
  }

  // Renvoie un entier dans une plage donnée
  randomInt(min: number, max: number): number {
    const delta = max - min;
    return this.randomBits() % delta + min;
  }
  
}