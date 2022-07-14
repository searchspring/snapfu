import arg from 'arg';
import { exit } from 'process';
import chalk from 'chalk';
import cmp from 'semver-compare';

import { login, logout, orgAccess } from './login';
import { initTemplate, listTemplates, removeTemplate, syncTemplate } from './recs';
import { init } from './init';
import { about } from './about';
import { help } from './help';
import { commandOutput, getContext } from './context';
import { setSecretKey, checkSecretKey } from './secret';

async function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--dev': Boolean,
			'--secret-key': String,
		},
		{
			argv: rawArgs.slice(2),
		}
	);
	const context = await getContext();
	let secretKey;
	try {
		secretKey = args['--secret-key'] || context.user.keys[context.searchspring.siteId];
	} catch (e) {
		// do nothing - when running init context may not exist
	}

	return {
		dev: args['--dev'] || false,
		command: args._[0],
		args: args._.slice(1),
		options: {
			secretKey,
		},
		context,
	};
}

export async function cli(args) {
	const options = await parseArgumentsIntoOptions(args);

	// drop out if not logged in for certain commands
	const userCommands = ['init', 'recs', 'recommendation', 'recommendations', 'secret', 'secrets', 'logout', 'whoami', 'org-access'];
	if (userCommands.includes(options.command) && (!options.context.user || !options.context.user.token)) {
		console.log(chalk.yellow(`Login is required. Please login.`));
		console.log(chalk.grey(`\n\tsnapfu login\n`));
		exit();
	}

	switch (options.command) {
		// cases requiring user login
		// ---------------------------

		case 'init': {
			await init(options);
			break;
		}

		case 'recs':
		case 'recommendation':
		case 'recommendations': {
			function showTemplateHelp() {
				help({ command: 'help', args: ['recommendation'] });
			}

			if (!options.args.length) {
				showTemplateHelp();
				return;
			}

			const [command] = options.args;

			switch (command) {
				case 'init':
					const [command, name, dir] = options.args;
					await initTemplate(options);
					break;

				case 'list':
					await listTemplates(options);
					break;

				case 'archive':
					await removeTemplate(options);
					break;

				case 'sync':
					await syncTemplate(options);
					break;

				default:
					showTemplateHelp();
					break;
			}

			break;
		}

		case 'secret':
		case 'secrets': {
			function showSecretHelp() {
				help({ command: 'help', args: ['secret'] });
			}

			if (!options.args.length) {
				showSecretHelp();
				return;
			}

			const [command] = options.args;

			switch (command) {
				case 'add':
				case 'update':
					await setSecretKey(options);
					break;

				case 'verify':
					await checkSecretKey(options);
					break;

				default:
					showSecretHelp();
					break;
			}

			break;
		}

		case 'logout': {
			try {
				await logout(options);
				console.log(`User ${chalk.cyan(options.context.user.login)} logged out.`);
			} catch (err) {
				console.log(chalk.red(err.message));
			}

			break;
		}

		case 'org-access': {
			orgAccess(options);
			break;
		}

		case 'whoami': {
			console.log(`${chalk.blue(options.context.user.name)} (${chalk.green(options.context.user.login)})`);
			break;
		}

		// cases not requiring user
		// -------------------------

		case 'login': {
			try {
				const creds = await login(options);
				console.log(`Authenticated ${chalk.cyan(creds.login)}`);
			} catch (err) {
				console.log(chalk.red(err.message));
			}

			break;
		}

		case 'about': {
			about(options);
			break;
		}

		default: {
			help(options);
			break;
		}
	}

	await checkForLatestVersion(options);

	exit();
}

function debug(options, message) {
	if (options.dev) {
		console.log(message);
	}
}

async function checkForLatestVersion(options) {
	// using Promise.race to wait a maximum of 1.2 seconds
	const latest = await Promise.race([commandOutput('npm view snapfu version'), wait(1200)]);

	if (latest && cmp(latest, options.context.version) == 1) {
		console.log(`\n\n${chalk.bold.white(`Version ${chalk.bold.red(`${latest}`)} of snapfu available.\nUpdate with:`)}`);
		console.log(chalk.grey(`\n\tnpm install -g snapfu\n`));
	}
}

function wait(us) {
	return new Promise((resolve) => {
		setTimeout(resolve, us);
	});
}
