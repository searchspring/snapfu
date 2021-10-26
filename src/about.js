import chalk from 'chalk';

export const about = (options) => {
	console.log(
		`${chalk.greenBright('snap · fu')} ${chalk.grey(' ~ ')} ${chalk.green.italic('"the way of snap"')}  ${chalk.red(
			`(v${options.context.version})`
		)}\n`
	);
	console.log(`${chalk.grey('─────────────────────────────────────────────')}\n`);
	console.log(`${chalk.bold.grey('https://github.com/searchspring/snap')}`);
};
