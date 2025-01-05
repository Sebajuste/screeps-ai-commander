import _ from "lodash";
import { Mem } from "memory/Memory";


export type SettingMemory = { [key: string]: any };

export class CommandSystem {

  private commands: { [key: string]: (...args: string[]) => void } = {};

  constructor() {
    this.init();
  }

  private init() {
    this.registerCommand('help', () => {
      const keys = _.keys(this.commands).join(' ');
      console.log(keys);
    });
  }

  public registerCommand(name: string, fn: (...args: string[]) => void): void {
    this.commands[name] = fn.bind(this);
  }

  public execute(input: string): any {
    const [commandName, ...args] = input.split(' ');
    if (this.commands[commandName]) {
      return this.commands[commandName](...args);
    } else {
      console.log(`Unknown command: ${commandName}`);
      return -1;
    }

  }
}

/**
 * Sets up the command system by binding it to the game object.
 * @param {CommandSystem} command - The CommandSystem instance to be set up.
 */
export function setupCommandSystem(command: CommandSystem) {
  const game = Game as any;
  game.command = (input: string) => {
    return command.execute(input);
  }
}
