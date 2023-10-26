import _ from "lodash";


export type GaleShapleyPreference = { [key: string]: string[] };
export type GaleShapleyFree = { [key: string]: boolean };
export type GaleShapleyMatch = { [key: string]: string };

export class GaleShapley {

  menPreferences: GaleShapleyPreference;
  womenPreferences: GaleShapleyPreference;

  men: string[];
  women: string[];

  menFree: GaleShapleyFree;
  womenFree: GaleShapleyFree;

  match: GaleShapleyMatch;

  constructor(menPreferences: GaleShapleyPreference, womenPreferences: GaleShapleyPreference) {
    this.menPreferences = menPreferences;
    this.womenPreferences = womenPreferences;

    this.men = Object.keys(menPreferences);
    this.women = Object.keys(womenPreferences);

    this.menFree = _.zipObject(this.men, _.map(this.men, man => true));
    this.womenFree = _.zipObject(this.women, _.map(this.women, woman => true));

    this.match = {};
  }

  private nextMan(): string | undefined {
    // return _.find(this.men, man => this.menFree[man] && this.menPreferences[man].length > 0);
    return _.find(Object.keys(this.menFree), man => this.menFree[man] && this.menPreferences[man].length > 0);
  }

  private separate(man: string, woman: string) {
    this.menFree[man] = true;
    this.womenFree[woman] = true;
    delete this.match[man];
  }

  private engage(man: string, woman: string) {
    this.match[man] = woman;
    this.menFree[man] = false;
    this.womenFree[woman] = false;
    _.remove(this.menPreferences[man], w => w == woman);
  }

  private prefers(woman: string, man1: string, man2: string): boolean {
    return _.indexOf(this.womenPreferences[woman], man1) < _.indexOf(this.womenPreferences[woman], man2);
  }

  matching(): GaleShapleyMatch {

    let count = 0;

    let man = this.nextMan();

    while (man) {

      if (count > 1000) {
        return this.match;
      }

      let woman = _.first(this.menPreferences[man]); // first w preference from m

      if (woman && this.womenFree[woman]) {
        // if w is free, (m, w) are now engage
        this.engage(man, woman);
      } else if (woman) {
        // (m', w) exist
        const lastMan = _.findKey(this.match, w => w == woman); // Find m'

        if (lastMan && this.prefers(woman, man, lastMan)) {
          // w prefer m than m'
          this.separate(lastMan, woman);  // m' become single
          this.engage(man, woman);        // (m, w) are now engage
        } else if (lastMan) {
          // (m', w) are always engaged
          _.remove(this.menPreferences[man], w => w == woman);
        }
      }
      man = this.nextMan(); // next m
      count++;
    }

    return this.match;
  }

}