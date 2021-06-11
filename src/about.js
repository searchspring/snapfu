import chalk from 'chalk';
import packageJSON from '../package.json';

export const about = (options) => {
	console.log(`${chalk.blue('snap · fu -')} ${chalk.blue.italic('"the way of snap"')} ${chalk.green(`(v${packageJSON.version})`)}\n`);
	console.log(`${chalk.blue('──────────────────────────────────────')}\n`);
	// console.log(`${chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`)
	console.log(`${chalk.blue('https://github.com/searchspring/snap')}\n`);
	// console.log(`${chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n`)
	console.log(`${chalk.blue('──────────────────────────────────────')}\n`);
	console.log(`${chalk.cyan('Searchspring')} ${chalk.red('❤')} ${chalk.cyan('2021')}`);
};
