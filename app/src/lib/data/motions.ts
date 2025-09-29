export type MotionKind = 'movement' | 'delete' | 'visual' | 'undo';

export type Motion = {
	keys: string | string[];
	label: string;
	desc: string;
	kind: MotionKind;
	level: number;
};

export const motions: Motion[] = [
	{ keys: 'h j k l', label: 'basic movement', desc: 'left, down, up, right', kind: 'movement', level: 1 },
	{ keys: ['w'], label: 'move word', desc: 'jump to start of next word', kind: 'movement', level: 1 },
	{ keys: ['b'], label: 'move back', desc: 'jump to first char of current word or start of previous word', kind: 'movement', level: 2 },
	{ keys: ['0'], label: 'start of line', desc: 'teleport to the start of current line', kind: 'movement', level: 3 },
	{ keys: ['^'], label: 'current line', desc: 'teleport to first char of current line', kind: 'movement', level: 4 },
	{ keys: ['e'], label: 'move end', desc: 'jump to last char of current word or end of next word', kind: 'movement', level: 5 },
	{ keys: ['$'], label: 'end of line', desc: 'teleport to end of line', kind: 'movement', level: 6 },
	{ keys: ['gg'], label: 'first line', desc: 'teleport to first line of file', kind: 'movement', level: 7 },
	{ keys: ['G'], label: 'last line', desc: 'teleport to last line of file', kind: 'movement', level: 8 },
	{ keys: ['f{char}'], label: 'find {char}', desc: 'teleport cursor to the next instance {char}', kind: 'movement', level: 9 },
	{ keys: ['F{char}'], label: 'find previous {char}', desc: 'teleport cursor to the previous instance {char}', kind: 'movement', level: 10 },
	{ keys: ['t{char}'], label: 'to {char}', desc: 'teleport cursor right before the next instance of {char}', kind: 'movement', level: 11 },
	{ keys: ['T{char}'], label: 'to previous {char}', desc: 'teleport cursor right before the previous instance of {char}', kind: 'movement', level: 12 },
	{ keys: ['Shift + v'], label: 'select line', desc: 'highlight the current line', kind: 'visual', level: 13 },
	{ keys: ['viw'], label: 'select in word', desc: 'highlight the current word', kind: 'visual', level: 14 },
	{ keys: ['vi(', 'vi)'], label: 'select in ()', desc: 'highlight content inside of current or next ()', kind: 'visual', level: 15 },
	{ keys: ['vi<', 'vi>'], label: 'select in <>', desc: 'highlight content inside of current or next <>', kind: 'visual', level: 16 },
	{ keys: ['d'], label: 'delete', desc: 'deletes current selection', kind: 'delete', level: 17 },
	{ keys: ['di(', 'di)'], label: 'delete in ()', desc: 'delete the contents of the current or next ()', kind: 'delete', level: 18 },
	{ keys: ['di<', 'di>'], label: 'delete in <>', desc: 'delete the contents of the current or next <>', kind: 'delete', level: 19 },
	{ keys: ['dd'], label: 'delete line', desc: 'deletes the current line', kind: 'delete', level: 20 },
	{ keys: ['u'], label: 'Undo', desc: 'undo your most recent edit', kind: 'undo', level: 21 }
];

export const getMotionByLevel = (level: number): Motion | undefined =>
	motions.find((motion) => motion.level === level);

export const getLatestMotionForLevel = (level: number): Motion | undefined => {
	let latest: Motion | undefined;
	for (const motion of motions) {
		if (motion.level > level) break;
		latest = motion;
	}
	return latest;
};
