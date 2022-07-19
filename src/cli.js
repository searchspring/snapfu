import arg from 'arg';
import { exit } from 'process';
import chalk from 'chalk';
import cmp from 'semver-compare';

import { login, logout, orgAccess } from './login';
import { initTemplate, listTemplates, removeTemplate, syncTemplate } from './recs';
import { init } from './init';
import { about } from './about';
import { wait } from './wait';
import { help } from './help';
import { commandOutput, getContext } from './context';
import { setSecretKey, checkSecretKey } from './secret';

async function parseArgumentsIntoOptions(rawArgs) {
	let args;

	try {
		args = arg(
			{
				'--dev': Boolean,
				'--secret-key': String,
				'--secrets-ci': String,
			},
			{
				argv: rawArgs.slice(2),
			}
		);
	} catch (e) {
		console.log(`Unexpected argument provided.`);
		exit(1);
	}

	const command = args._[0];

	const context = await getContext();

	let secretKey;
	try {
		secretKey = args['--secret-key'] || context.user.keys[context.searchspring.siteId];
	} catch (e) {
		// do nothing - when running init context may not exist
	}

	let multipleSites = [];

	// drop out if not logged in for certain commands
	const userCommands = ['init', 'recs', 'recommendation', 'recommendations', 'secret', 'secrets', 'logout', 'whoami', 'org-access'];
	const secretCommands = ['recs', 'recommendation', 'recommendations', 'secret', 'secrets'];

	const loggedIn = context.user && context.user.token;
	const secretOptions = args['--secrets-ci'] || secretKey;

	if (userCommands.includes(command) && !(loggedIn || secretOptions)) {
		console.log(chalk.yellow(`Login is required. Please login.`));
		console.log(chalk.grey(`\n\tsnapfu login\n`));
		exit(1);
	} else if (secretCommands.includes(command) && (loggedIn || secretOptions)) {
		const getSecretKeyFromCLI = (siteId) => {
			try {
				const secrets = JSON.parse(args['--secrets-ci']);
				const secretKey = secrets[`WEBSITE_SECRET_KEY_${siteId.toUpperCase()}`];
				return secretKey;
			} catch (e) {
				return;
			}
		};

		if (context.searchspring && typeof context.searchspring.siteId === 'object') {
			// searchsoring.siteId contains multiple sites

			const siteIds = Object.keys(context.searchspring.siteId);
			if (!siteIds || !siteIds.length) {
				console.log(chalk.red('searchspring.siteId object in package.json is empty'));
				exit(1);
			}

			multipleSites = siteIds
				.map((siteId) => {
					try {
						const { name } = context.searchspring.siteId[siteId];
						const secretKey = getSecretKeyFromCLI(siteId) || context.user.keys[siteId];

						if (!secretKey) {
							console.log(chalk.red(`Cannot find the secretKey for siteId '${siteId}'.`));
							console.log(chalk.bold.white(`Please run the following command:`));
							console.log(chalk.gray(`\tsnapfu secrets add\n`));
						}
						if (!secretKey && args['--secrets-ci']) {
							console.log(
								chalk.red(`Could not find Github secret 'WEBSITE_SECRET_KEY_${siteId.toUpperCase()}' in 'secrets' input
	It can be added by running 'snapfu secrets add' in the project's directory locally, 
	or added manual in the project's repository secrets. 
	The value can be obtained in the Searchspring Management Console.
	Then ensure that you are providing 'secrets' when running the action. ie:
	
	jobs:
	  Publish:
		runs-on: ubuntu-latest
		name: Snap Action
		steps:
		  - name: Checkout action
			uses: actions/checkout@v2
			with:
			  repository: searchspring/snap-action
		  - name: Run @searchspring/snap-action
			uses: ./
			with:
			  secrets: \${{ toJSON(secrets) }}
			  ...
	`)
							);
						}

						return {
							siteId,
							name,
							secretKey,
						};
					} catch (e) {
						console.log(chalk.red('The searchspring.siteId object in package.json is invalid. Expected format:'));
						console.log(
							chalk.red(`
	"searchspring": {
		"siteId": {
			"xxxxx1": {
				"name": "site1.com.au"
			},
			"xxxxx2": {
				"name": "site2.hk"
			}
		},
	}`)
						);
						exit(1);
					}
				})
				.filter((site) => site.secretKey);
		}
	}

	return {
		dev: args['--dev'] || false,
		command,
		args: args._.slice(1),
		options: {
			secretKey,
			secrets: args['--secrets-ci'],
		},
		context,
		multipleSites,
	};
}

export async function cli(args) {
	const options = await parseArgumentsIntoOptions(args);

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
