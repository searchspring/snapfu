import chalk from 'chalk';
import packageJSON from '../package.json';

export const about = (options) => {
	console.log(`${chalk.blue('snap · fu - "the way of snap"')} ${chalk.red(`(v${packageJSON.version})`)}`);
};
