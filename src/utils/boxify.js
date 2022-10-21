import chalk from 'chalk';

export function boxify(inside, message) {
	const boxTop = `┌${'─'.repeat(inside.length)}┐`;
	const boxMiddle = `│${chalk.bold(inside)}│ ${message || ''}`;
	const boxBottom = `└${'─'.repeat(inside.length)}┘`;

	return `${boxTop}\n${boxMiddle}\n${boxBottom}`;
}

export function boxifyVersions(v1, v2) {
	const versionSeparator = ' --> ';
	const boxTop = `┌${'─'.repeat(v1.length)}┐${' '.repeat(versionSeparator.length)}┌${'─'.repeat(v2.length)}┐`;
	const boxMiddle = `│${chalk.bold(v1)}│${versionSeparator}│${chalk.bold(v2)}│`;
	const boxBottom = `└${'─'.repeat(v1.length)}┘${' '.repeat(versionSeparator.length)}└${'─'.repeat(v2.length)}┘`;

	return `${boxTop}\n${boxMiddle}\n${boxBottom}`;
}
