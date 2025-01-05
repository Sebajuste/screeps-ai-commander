
export class RandomSeeded {
  
  private previousValue : number;

  constructor(seed: number) {
    this.previousValue  = seed >>> 0;
  }

  // Génère un nombre pseudo-aléatoire entre 0 et 1 en utilisant LCG
  private randomBits(): number {
    const a = 1664525;  // Multiplicateur recommandé
    const c = 1013904223; // Incrément recommandé
    const m = 2 ** 32; // Modulo pour un entier non signé 32 bits

    this.previousValue  = (a * this.previousValue  + c) % m; // LCG formule
    return this.previousValue;
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