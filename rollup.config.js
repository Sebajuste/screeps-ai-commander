"use strict";

import clear from 'rollup-plugin-clear';
import progress from 'rollup-plugin-progress';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import uglify from "@lopatnov/rollup-plugin-uglify";
import screeps from 'rollup-plugin-screeps';

const pkg = require("./package.json");

// `SET NODE_ENV=x &&` leaves a trailing space, and the watch/push-local scripts set nothing at all.
const nodeEnv = (process.env.NODE_ENV || 'development').trim().toUpperCase();
const isProduction = nodeEnv === 'PRODUCTION' || nodeEnv === 'PROD';

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log('\x1b[46m%s\x1b[0m \x1b[36m%s\x1b[0m', 'Compiling ...', `(${nodeEnv}, deploy destination: none)`);
} else if ((cfg = require("./.screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
} else {
  console.log('\x1b[46m%s\x1b[0m \x1b[36m%s\x1b[0m', 'Compiling ...', `(${nodeEnv}, deploy destination: ${dest})`);
}

const ignoreWarnings = [
  'commonjs-proxy',
  'Circular dependency',
  "The 'this' keyword is equivalent to 'undefined'",
  "Use of eval is strongly discouraged"
];

const uglifyOptions = {
  ecma: 2018,       // matches tsconfig target; ecma 5 forbade the shortest output forms
  enclose: false,
  keep_classnames: true,  // screeps-profiler reads constructor names
  keep_fnames: false,
  module: false
};

export default {
  input: "src/main.ts",

  plugins: [
    clear({ targets: ["dist"] }),
    progress({ clearLine: true }),
    resolve({ rootDir: "src" }),
    commonjs({
      namedExports: {
        'screeps-profiler': ['profiler'],
        'columnify': ['columnify']
      }
    }),
    typescript({ tsconfig: "./tsconfig.json" }),
    isProduction && uglify(uglifyOptions),
    screeps({ config: cfg, dryRun: cfg == null })
  ],

  onwarn: function (warning) {
    for (let ignoreWarning of ignoreWarnings) {
      if (warning.toString().includes(ignoreWarning)) {
        return;
      }
    }
    console.warn(warning.message);
  },

  // Drops unused exports. moduleSideEffects stays on: traveler.js patches
  // Creep.prototype at module level and must not be elided.
  treeshake: {
    moduleSideEffects: true
  },

  output: [{
    file: pkg.main,
    format: "cjs",
    // The map is uploaded to the server as a second module (~600 KB). Dev only.
    sourcemap: !isProduction,
    banner: "//\n" +
      "//             _____   _____                                          _           \n" +
      "//       /\\   |_   _| / ____|                                        | |          \n" +
      "//      /  \\    | |  | |     ___  _ __ ___  _ __ ___   __ _ _ __   __| | ___ _ __ \n" +
      "//     / /\\ \\   | |  | |    / _ \\| '_ ` _ \\| '_ ` _ \\ / _` | '_ \\ / _` | / _ \\ '__|\n" +
      "//    / ____ \\ _| |_ | |___| (_) | | | | | | | | | | | (_| | | | | (_| |  __/ |   \n" +
      "//   /_/    \\_\\_____| \\_____\\___/|_| |_| |_|_| |_| |_|\\__,_|_| |_|\\__,_|\\___|_|   \n" +
      "//                ______                                                          \n" +
      "//               |______|                                                         \n" +
      "//\n" +
      "//\n" +
      "// Repository: \n" +
      "//\n"
  }],
};
