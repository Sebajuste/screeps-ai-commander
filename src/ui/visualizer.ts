import { StructureLayout, StructureMap } from "hub/room-planner/room-planner";
import _ from "lodash";


const TEXT_COLOR = '#c9c9c9';
const TEXT_SIZE = .8;
const CHAR_WIDTH = TEXT_SIZE * 0.4;
const CHAR_HEIGHT = TEXT_SIZE * 0.9;

const DIRS = [
	[],
	[0, -1],
	[1, -1],
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[-1, -1]
];

const colors = {
	gray: '#555555',
	light: '#AAAAAA',
	road: '#666', // >:D
	energy: '#FFE87B',
	power: '#F53547',
	dark: '#181818',
	outline: '#8FBB93',
	speechText: '#000000',
	speechBackground: '#aebcc4',
	infoBoxGood: '#09ff00',
	infoBoxBad: '#ff2600'
};

function relPoly(x: number, y: number, poly: [number, number][]): [number, number][] {
	return poly.map(p => {
		p[0] += x;
		p[1] += y;
		return p;
	});
}

export class Visualizer {

	/*
	static get enabled(): boolean {
	return Memory.settings.enableVisuals;
}
	*/

	private static textStyle(size = 1, style: TextStyle = {}) {
		return _.defaults(style, {
			color: TEXT_COLOR,
			align: 'left',
			font: `${size * TEXT_SIZE} Trebuchet MS`,
			opacity: 0.8,
		});
	}

	static box(pos: { x: number, y: number, roomName?: string }, width: number, height: number, opts: { color?: string } = {}) {
		const vis = new RoomVisual(pos.roomName);
		vis.line(pos.x, pos.y, pos.x + width, pos.y);
		vis.line(pos.x, pos.y + height, pos.x + width, pos.y + height);
		vis.line(pos.x, pos.y, pos.x, pos.y + height);
		vis.line(pos.x + width, pos.y, pos.x + width, pos.y + height);
	}

	static text(line: string, pos: { x: number, y: number, roomName?: string }): void {

	}

	static multitext(lines: string[], pos: { x: number, y: number, roomName?: string }): { x: number, y: number } {
		if (lines.length == 0) {
			return pos;
		}
		const vis = new RoomVisual(pos.roomName);
		const style = this.textStyle();
		// Draw text
		let dy = 0;
		for (const line of lines) {
			vis.text(line, pos.x, pos.y + dy, style);
			dy += CHAR_HEIGHT;
		}
		return { x: pos.x, y: pos.y + dy };
	}

	static section(title: string, pos: { x: number, y: number, roomName?: string }, width: number, height: number): { x: number, y: number } {
		const vis = new RoomVisual(pos.roomName);
		vis.rect(pos.x, pos.y - CHAR_HEIGHT, width, 1.1 * CHAR_HEIGHT, { opacity: 0.15 });
		// vis.box(pos.x, pos.y - CHAR_HEIGHT, width, height + (1.1 + .25) * CHAR_HEIGHT, {color: TEXT_COLOR});
		this.box({ x: pos.x, y: pos.y - CHAR_HEIGHT, roomName: pos.roomName }, width, height + (1.1 + .25) * CHAR_HEIGHT, { color: TEXT_COLOR });
		vis.text(title, pos.x + .25, pos.y - .05, this.textStyle());
		return { x: pos.x + 0.25, y: pos.y + 1.1 * CHAR_HEIGHT };
	}

	static info_box(header: string, content: string[] | string[][], pos: { x: number, y: number, roomName?: string }, width: number): number {
		// const vis = new RoomVisual(pos.roomName);
		// vis.rect(pos.x, pos.y - charHeight, width, 1.1 * charHeight, {opacity: 0.15});
		// vis.box(pos.x, pos.y - charHeight, width, ((content.length || 1) + 1.1 + .25) * charHeight,
		// 		{color: textColor});
		// vis.text(header, pos.x + .25, pos.y - .05, this.textStyle());
		const height = CHAR_HEIGHT * (content.length || 1);
		const { x, y } = this.section(header, pos, width, height);
		if (content.length > 0) {
			if (_.isArray(content[0])) {
				this.table(<string[][]>content, {
					x: x,
					y: y,
					roomName: pos.roomName
				});
			} else {
				this.multitext(<string[]>content, {
					x: x,
					y: y,
					roomName: pos.roomName
				});
			}
		}
		// return pos.y - charHeight + ((content.length || 1) + 1.1 + .25) * charHeight + 0.1;
		const spaceBuffer = 0.5;
		return y + CHAR_HEIGHT + height + spaceBuffer;
	}

	static table(data: string[][], pos: { x: number, y: number, roomName?: string }, styles?: TextStyle[]): void {
		if (data.length == 0) {
			return;
		}
		const colPadding = 4;
		const vis = new RoomVisual(pos.roomName);

		// Determine column locations
		const columns = Array(_.first(data)?.length).fill(0);
		for (const entries of data) {
			for (let i = 0; i < entries.length - 1; i++) {
				columns[i] = Math.max(columns[i], entries[i].length);
			}
		}

		// // Draw header and underline
		// vis.text(header, pos.x, pos.y, style);
		// vis.line(pos.x, pos.y + .3 * charHeight,
		// 	pos.x + charWidth * _.sum(columns) + colPadding * columns.length, pos.y + .25 * charHeight, {
		// 			 color: textColor
		// 		 });

		// Draw text
		// let dy = 1.5 * charHeight;

		const globalStyle = this.textStyle();

		let dy = 0;
		for (const entries of data) {
			let dx = 0;
			for (const i in entries) {
				const textStyle = styles ? _.defaults(styles[i], globalStyle) : globalStyle;
				vis.text(entries[i], pos.x + dx, pos.y + dy, textStyle);
				dx += CHAR_WIDTH * (columns[i] + colPadding);
			}
			dy += CHAR_HEIGHT;
		}
	}


	/*
	 * 
	 * 
	 */

	// structure = function(x: number, y: number, type: string, opts = {}): RoomVisual {
	static structure(x: number, y: number, roomName: string, type: string, opts: any = {}) {
		const vis = new RoomVisual(roomName);
		_.defaults(opts, { opacity: 0.5 });
		switch (type) {
			case STRUCTURE_EXTENSION:
				vis.circle(x, y, {
					radius: 0.5,
					fill: colors.dark,
					stroke: colors.outline,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				vis.circle(x, y, {
					radius: 0.35,
					fill: colors.gray,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_SPAWN:
				vis.circle(x, y, {
					radius: 0.65,
					fill: colors.dark,
					stroke: '#CCCCCC',
					strokeWidth: 0.10,
					opacity: opts.opacity
				});
				vis.circle(x, y, {
					radius: 0.40,
					fill: colors.energy,
					opacity: opts.opacity
				});

				break;
			case STRUCTURE_POWER_SPAWN:
				vis.circle(x, y, {
					radius: 0.65,
					fill: colors.dark,
					stroke: colors.power,
					strokeWidth: 0.10,
					opacity: opts.opacity
				});
				vis.circle(x, y, {
					radius: 0.40,
					fill: colors.energy,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_LINK: {
				// let osize = 0.3;
				// let isize = 0.2;
				let outer: [number, number][] = [
					[0.0, -0.5],
					[0.4, 0.0],
					[0.0, 0.5],
					[-0.4, 0.0]
				];
				let inner: [number, number][] = [
					[0.0, -0.3],
					[0.25, 0.0],
					[0.0, 0.3],
					[-0.25, 0.0]
				];
				outer = relPoly(x, y, outer);
				inner = relPoly(x, y, inner);
				outer.push(outer[0]);
				inner.push(inner[0]);
				vis.poly(outer, {
					fill: colors.dark,
					stroke: colors.outline,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				vis.poly(inner, {
					fill: colors.gray,
					// stroke : false,
					opacity: opts.opacity
				});
				break;
			}
			case STRUCTURE_TERMINAL: {
				let outer: [number, number][] = [
					[0.0, -0.8],
					[0.55, -0.55],
					[0.8, 0.0],
					[0.55, 0.55],
					[0.0, 0.8],
					[-0.55, 0.55],
					[-0.8, 0.0],
					[-0.55, -0.55],
				];
				let inner: [number, number][] = [
					[0.0, -0.65],
					[0.45, -0.45],
					[0.65, 0.0],
					[0.45, 0.45],
					[0.0, 0.65],
					[-0.45, 0.45],
					[-0.65, 0.0],
					[-0.45, -0.45],
				];
				outer = relPoly(x, y, outer);
				inner = relPoly(x, y, inner);
				outer.push(outer[0]);
				inner.push(inner[0]);
				vis.poly(outer, {
					fill: colors.dark,
					stroke: colors.outline,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				vis.poly(inner, {
					fill: colors.light,
					// stroke : false,
					opacity: opts.opacity
				});
				vis.rect(x - 0.45, y - 0.45, 0.9, 0.9, {
					fill: colors.gray,
					stroke: colors.dark,
					strokeWidth: 0.1,
					opacity: opts.opacity
				});
				break;
			}
			case STRUCTURE_LAB:
				vis.circle(x, y - 0.025, {
					radius: 0.55,
					fill: colors.dark,
					stroke: colors.outline,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				vis.circle(x, y - 0.025, {
					radius: 0.40,
					fill: colors.gray,
					opacity: opts.opacity
				});
				vis.rect(x - 0.45, y + 0.3, 0.9, 0.25, {
					fill: colors.dark,
					// stroke : false,
					opacity: opts.opacity
				});
				{
					let box: [number, number][] = [
						[-0.45, 0.3],
						[-0.45, 0.55],
						[0.45, 0.55],
						[0.45, 0.3],
					];
					box = relPoly(x, y, box);
					vis.poly(box, {
						stroke: colors.outline,
						strokeWidth: 0.05,
						opacity: opts.opacity
					});
				}
				break;
			case STRUCTURE_TOWER:
				vis.circle(x, y, {
					radius: 0.6,
					fill: colors.dark,
					stroke: colors.outline,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				vis.rect(x - 0.4, y - 0.3, 0.8, 0.6, {
					fill: colors.gray,
					opacity: opts.opacity
				});
				vis.rect(x - 0.2, y - 0.9, 0.4, 0.5, {
					fill: colors.light,
					stroke: colors.dark,
					strokeWidth: 0.07,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_ROAD:
				vis.circle(x, y, {
					radius: 0.175,
					fill: colors.road,
					// stroke : false,
					opacity: opts.opacity
				});
				// if (!this.roads) this.roads = [];
				// this.roads.push([x, y]);
				break;
			case STRUCTURE_RAMPART:
				vis.circle(x, y, {
					radius: 0.65,
					fill: '#434C43',
					stroke: '#5D735F',
					strokeWidth: 0.10,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_WALL:
				vis.circle(x, y, {
					radius: 0.40,
					fill: colors.dark,
					stroke: colors.light,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_STORAGE:
				const storageOutline = relPoly(x, y, [
					[-0.45, -0.55],
					[0, -0.65],
					[0.45, -0.55],
					[0.55, 0],
					[0.45, 0.55],
					[0, 0.65],
					[-0.45, 0.55],
					[-0.55, 0],
					[-0.45, -0.55],
				]);
				vis.poly(storageOutline, {
					stroke: colors.outline,
					strokeWidth: 0.05,
					fill: colors.dark,
					opacity: opts.opacity
				});
				vis.rect(x - 0.35, y - 0.45, 0.7, 0.9, {
					fill: colors.energy,
					opacity: opts.opacity,
				});
				break;
			case STRUCTURE_OBSERVER:
				vis.circle(x, y, {
					fill: colors.dark,
					radius: 0.45,
					stroke: colors.outline,
					strokeWidth: 0.05,
					opacity: opts.opacity
				});
				vis.circle(x + 0.225, y, {
					fill: colors.outline,
					radius: 0.20,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_NUKER:
				let outline: [number, number][] = [
					[0, -1],
					[-0.47, 0.2],
					[-0.5, 0.5],
					[0.5, 0.5],
					[0.47, 0.2],
					[0, -1],
				];
				outline = relPoly(x, y, outline);
				vis.poly(outline, {
					stroke: colors.outline,
					strokeWidth: 0.05,
					fill: colors.dark,
					opacity: opts.opacity
				});
				let inline: [number, number][] = [
					[0, -.80],
					[-0.40, 0.2],
					[0.40, 0.2],
					[0, -.80],
				];
				inline = relPoly(x, y, inline);
				vis.poly(inline, {
					stroke: colors.outline,
					strokeWidth: 0.01,
					fill: colors.gray,
					opacity: opts.opacity
				});
				break;
			case STRUCTURE_CONTAINER:
				vis.rect(x - 0.225, y - 0.3, 0.45, 0.6, {
					fill: 'yellow',
					opacity: opts.opacity,
					stroke: colors.dark,
					strokeWidth: 0.10,
				});
				break;
			default:
				vis.circle(x, y, {
					fill: colors.light,
					radius: 0.35,
					stroke: colors.dark,
					strokeWidth: 0.20,
					opacity: opts.opacity
				});
				break;
		}

		return this;
	}

	/*
	static connectRoads(opts : any = {}): RoomVisual | void {
		_.defaults(opts, {opacity: 0.5});
		const color = opts.color || colors.road || 'white';
		if (!this.roads) return;
		// this.text(this.roads.map(r=>r.join(',')).join(' '),25,23)
		this.roads.forEach((r: number[]) => {
			// this.text(`${r[0]},${r[1]}`,r[0],r[1],{ size: 0.2 })
			for (let i = 1; i <= 4; i++) {
				const d = dirs[i];
				const c = [r[0] + d[0], r[1] + d[1]];
				const rd = _.some(<number[][]>this.roads, r => r[0] == c[0] && r[1] == c[1]);
				// this.text(`${c[0]},${c[1]}`,c[0],c[1],{ size: 0.2, color: rd?'green':'red' })
				if (rd) {
					this.line(r[0], r[1], c[0], c[1], {
						color  : color,
						width  : 0.35,
						opacity: opts.opacity
					});
				}
			}
		});
	
		return this;
	};
	*/

	static drawLayout(layout: StructureLayout, anchor: RoomPosition, opts: any = {}): void {
		_.defaults(opts, { opacity: 0.5 });
		// if (!this.enabled) return;
		const vis = new RoomVisual(anchor.roomName);
		for (const structureType in layout[8]!.structures) {
			for (const pos of layout[8]!.structures[structureType]) {
				const dx = pos.x - layout.data.anchor.x;
				const dy = pos.y - layout.data.anchor.y;
				this.structure(anchor.x + dx, anchor.y + dy, anchor.roomName, structureType, opts);
			}
		}
		// vis.connectRoads(opts);
	}

	static drawStructureMap(structureMap: StructureMap): void {
		// if (!this.enabled) return;
		// const vis: { [roomName: string]: RoomVisual } = {};
		for (const structureType in structureMap) {
			for (const pos of structureMap[structureType]) {
				/*
				if (!vis[pos.roomName]) {
					vis[pos.roomName] = new RoomVisual(pos.roomName);
				}
				*/
				// vis[pos.roomName].structure(pos.x, pos.y, structureType);
				this.structure(pos.x, pos.y, pos.roomName, structureType)
			}
		}
		/*
		for (const roomName in vis) {
			vis[roomName].connectRoads();
		}
		*/
	}

	static connectRoads(roomName: string, roads: RoomPosition[], opts: any = {}) {
		_.defaults(opts, { opacity: 0.5 });
		const color = opts.color || colors.road || 'white';
		const vis = new RoomVisual(roomName);

		roads.forEach((pos: RoomPosition) => {
			// this.text(`${r[0]},${r[1]}`,r[0],r[1],{ size: 0.2 })
			for (let i = 1; i <= 4; i++) {
				const d = DIRS[i];
				const c = [pos.x + d[0], pos.y + d[1]];
				// const rd = _.some(<number[][]>this.roads, r => r[0] == c[0] && r[1] == c[1]);
				const rd = _.some(roads, p => pos.x == c[0] && p.y == c[1]);
				// this.text(`${c[0]},${c[1]}`,c[0],c[1],{ size: 0.2, color: rd?'green':'red' })
				if (rd) {
					vis.line(pos.x, pos.y, c[0], c[1], {
						color: color,
						width: 0.35,
						opacity: opts.opacity
					});
				}
			}
		});


	}

	static drawRoads(positions: RoomPosition[]): void {
		const pointsByRoom = _.groupBy(positions, pos => pos.roomName);
		for (const roomName in pointsByRoom) {

			for (const pos of pointsByRoom[roomName]) {
				this.structure(pos.x, pos.y, roomName, STRUCTURE_ROAD);
			}
			this.connectRoads(roomName, positions);
		}
	}


}