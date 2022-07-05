import { exit } from 'process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { setRepoSecret } from './init';
import { ConfigApi } from './services/ConfigApi';
import { auth } from './login';
import { wait } from './wait';

export const setSecretKey = async (options) => {
	if (!options.context || !options.context.searchspring || !options.context.project || !options.context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		exit(1);
	}

	const questions = [
		{
			type: 'input',
			name: 'secretKey',
			message: 'Please enter the secretKey as found in the SMC console (32 characters):',
			validate: (input) => {
				return input && input.length > 0 && /^[0-9a-zA-Z]{32}$/.test(input);
			},
		},
	];

	if (typeof options.context.searchspring.siteId === 'object') {
		const choices = Object.keys(options.context.searchspring.siteId);
		if (choices.length) {
			questions.unshift({
				type: 'list',
				name: 'siteId',
				message: 'Please select which siteId to add/update the secretKey for:',
				choices,
				default: choices[0],
			});
		}
	}

	const answers = await inquirer.prompt(questions);
	console.log();

	const { secretKey } = answers;
	const siteId = answers.siteId || options.context.searchspring.siteId;
	const { organization, name } = options.context.repository;

	if (!siteId || !organization || !name) {
		console.log(chalk.red(`Error: Project is misconfigured.`));
		exit(1);
	}

	try {
		try {
			await new ConfigApi(secretKey, options.dev).validateSite(name, siteId);
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

	const keys = options.context.user.keys || {};
	let siteId = options.context.searchspring.siteId;
	let name = options.context.repository.name;

	try {
		if (options.multipleSites.length) {
			for (let i = 0; i < options.multipleSites.length; i++) {
				const { siteId, name, secretKey } = options.multipleSites[i];
				try {
					await new ConfigApi(secretKey, options.dev).validateSite(name, siteId);
					console.log(chalk.green(`Verification of siteId and secretKey complete for ${name}`));
				} catch (err) {
					console.log(chalk.red(`Verification of siteId and secretKey failed for ${name}`));
					console.log(chalk.red(err));
					exit(1);
				}

				// prevent rate limiting
				await wait(1111);
			}
		} else {
			let secretKey = keys[siteId];
			try {
				await new ConfigApi(secretKey, options.dev).validateSite(name, siteId);
				console.log(chalk.green('Verification of siteId and secretKey complete.'));
			} catch (err) {
				console.log(chalk.red('Verification of siteId and secretKey failed.'));
				console.log(chalk.red(err));
				exit(1);
			}
		}
	} catch (err) {
		console.log(chalk.red(err));
		exit(1);
	}
};
