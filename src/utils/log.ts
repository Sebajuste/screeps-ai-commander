import _ from "lodash";

const stackLineRe = /([^ ]*) \(([^:]*):([0-9]*):([0-9]*)\)/;
const FATAL = -1;
const fatalColor = '#d65156';

export const LOG_MAX_PAD: number = 100;

export const LOG_VSC = {repo: '@@_repo_@@', revision: '@@_revision_@@', valid: false};

export const LOG_VSC_URL_TEMPLATE = (path: string, line: string) => {
	return `${LOG_VSC.repo}/blob/${LOG_VSC.revision}/${path}#${line}`;
};

export enum LogLevels {
	ERROR,		// log.level = 0
	WARNING,	// log.level = 1
	ALERT,		// log.level = 2
	INFO,		// log.level = 3
	DEBUG		// log.level = 4
}



export function color(str: string, color: string): string {
	return `<font color='${color}'>${str}</font>`;
}

interface SourcePos {
	compiled: string;
	final: string;
	original: string | undefined;
	caller: string | undefined;
	path: string | undefined;
	line: number | undefined;
}

export function resolve(fileLine: string): SourcePos {
	const split = _.trim(fileLine).match(stackLineRe);
	if (!split || !Log.sourceMap) {
		return {compiled: fileLine, final: fileLine} as SourcePos;
	}

	const pos = {column: parseInt(split[4], 10), line: parseInt(split[3], 10)};

	const original = Log.sourceMap.originalPositionFor(pos);
	const line = `${split[1]} (${original.source}:${original.line})`;
	const out = {
		caller  : split[1],
		compiled: fileLine,
		final   : line,
		line    : original.line,
		original: line,
		path    : original.source,
	};

	return out;
}

function time(): string {
	return color(Game.time.toString(), 'gray');
}

function vscUrl(path: string, line: string): string {
	return LOG_VSC_URL_TEMPLATE(path, line);
}

function link(href: string, title: string): string {
	return `<a href='${href}' target="_blank">${title}</a>`;
}

function tooltip(str: string, tooltip: string): string {
	return `<abbr title='${tooltip}'>${str}</abbr>`;
}

function makeVSCLink(pos: SourcePos): string {
	if (!LOG_VSC.valid || !pos.caller || !pos.path || !pos.line || !pos.original) {
		return pos.final;
	}

	return link(vscUrl(pos.path, `L${pos.line.toString()}`), pos.original);
}

export class Log {

    static sourceMap: any;

    private _maxFileString: number = 0;

    get level(): number {
		// return Memory.settings.log.level;
        return 4;
	}

    get showTick(): boolean {
		// return Memory.settings.log.showTick;
        return true;
	}

    get showSource(): boolean {
		// return Memory.settings.log.showSource;
        return true;
	}

    private adjustFileLine(visibleText: string, line: string): string {
		const newPad = Math.max(visibleText.length, this._maxFileString);
		this._maxFileString = Math.min(newPad, LOG_MAX_PAD);

		// return `|${_.padRight(line, line.length + this._maxFileString - visibleText.length, ' ')}|`;
        return `|${line.padEnd(line.length + this._maxFileString - visibleText.length, ' ')}`;
	}

    private buildArguments(level: number): string[] {
		const out: string[] = [];
		switch (level) {
			case LogLevels.ERROR:
				out.push(color('ERROR  ', 'red'));
				break;
			case LogLevels.WARNING:
				out.push(color('WARNING', 'orange'));
				break;
			case LogLevels.ALERT:
				out.push(color('ALERT  ', 'yellow'));
				break;
			case LogLevels.INFO:
				out.push(color('INFO   ', 'green'));
				break;
			case LogLevels.DEBUG:
				out.push(color('DEBUG  ', 'gray'));
				break;
			case FATAL:
				out.push(color('FATAL  ', fatalColor));
				break;
			default:
				break;
		}
		if (this.showTick) {
			out.push(time());
		}
		if (this.showSource && level <= LogLevels.ERROR) {
			out.push(this.getFileLine());
		}
		return out;
	}

    getFileLine(upStack = 4): string {
		const stack = new Error('').stack;

		if (stack) {
			const lines = stack.split('\n');

			if (lines.length > upStack) {
				const originalLines = _.drop(lines, upStack).map(resolve);
				const hoverText = _.map(originalLines, 'final').join('&#10;');
				return this.adjustFileLine(
					originalLines[0].final,
					tooltip(makeVSCLink(originalLines[0]), hoverText)
				);
			}
		}
		return '';
	}

    debug(...args: any[]) {
        if (this.level >= LogLevels.DEBUG) {
			console.log.apply(this, this.buildArguments(LogLevels.DEBUG).concat([].slice.call(args)));
		}
    }

    info(...args: any[]) {
        if (this.level >= LogLevels.INFO) {
			console.log.apply(this, this.buildArguments(LogLevels.INFO).concat([].slice.call(args)));
		}
    }

    alert(...args: any[]) {
        if (this.level >= LogLevels.ALERT) {
			console.log.apply(this, this.buildArguments(LogLevels.ALERT).concat([].slice.call(args)));
		}
    }

    warning(...args: any[]) {
        if (this.level >= LogLevels.WARNING) {
			console.log.apply(this, this.buildArguments(LogLevels.WARNING).concat([].slice.call(args)));
		}
    }

    error(...args: any[]) {
        if (this.level >= LogLevels.ERROR) {
			console.log.apply(this, this.buildArguments(LogLevels.ERROR).concat([].slice.call(args)));
		}
    }

	fatal(...args: any[]) {
        if (this.level >= FATAL) {
			console.log.apply(this, this.buildArguments(FATAL).concat([].slice.call(args)));
		}
    }

}


export const log = new Log();