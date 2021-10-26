import { exit } from 'process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { setRepoSecret } from './init';
import { ConfigApi } from './services/ConfigApi';
import { auth } from './login';

export const setSecretKey = async (options) => {
	if (!options.context || !options.context.searchspring || !options.context.project || !options.context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		exit(1);
	}

	const answers = await inquirer.prompt({
		type: 'input',
		name: 'secretKey',
		message: 'Please enter the secretKey as found in the SMC console (32 characters):',
		validate: (input) => {
			return input && input.length > 0 && /^[0-9a-zA-Z]{32}$/.test(input);
		},
	});
	console.log();

	const { secretKey } = answers;
	const { siteId } = options.context.searchspring;
	const { organization, name } = options.context.repository;

	if (!siteId || !organization || !name) {
		console.log(chalk.red(`Error: Project is misconfigured.`));
		exit(1);
	}

	try {
		try {
			await new ConfigApi(secretKey, options.dev).validateSite(siteId);
		} catch (err) {
			console.log(chalk.red('Verification of siteId and secretKey failed.'));
			console.log(chalk.red(err));
			exit(1);
		}

		await auth.saveSecretKey(secretKey, siteId);
		await setRepoSecret(options, { siteId, secretKey, organization, name });
	} catch (err) {
		console.log(chalk.red(err));
		exit(1);
	}
};

export const checkSecretKey = async (options) => {
	if (!options.context || !options.context.searchspring || !options.context.project || !options.context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		exit(1);
	}

	const { siteId } = options.context.searchspring;
	const keys = options.context.user.keys || {};
	const secretKey = keys[siteId];

	try {
		try {
			await new ConfigApi(secretKey, options.dev).validateSite(siteId);
			console.log(chalk.green('Verification of siteId and secretKey complete.'));
		} catch (err) {
			console.log(chalk.red('Verification of siteId and secretKey failed.'));
			console.log(chalk.red(err));
			exit(1);
		}
	} catch (err) {
		console.log(chalk.red(err));
		exit(1);
	}
};
