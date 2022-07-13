import arg from 'arg';
import { exit } from 'process';
import chalk from 'chalk';
import cmp from 'semver-compare';

import { login, orgAccess, whoami } from './login';
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
			'--secrets-ci': String,
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

	let multipleSites = [];

	const getSecretKeyFromCLI = (siteId) => {
		try {
			const secrets = JSON.parse(args['--secrets-ci']);
			const secretKey =
				secrets[`WEBSITE_SECRET_KEY_${siteId.toUpperCase()}`] ||
				secrets[`WEBSITE_SECRET_KEY_${siteId}`] ||
				secrets[`WEBSITE_SECRET_KEY_${siteId.toLowerCase()}`];
			return secretKey;
		} catch (e) {
			console.log('Could not parse secrets-ci');
		}
	};

	if (typeof context.searchspring.siteId === 'object') {
		// searchsoring.siteId contains multiple sites

		const siteIds = Object.keys(context.searchspring.siteId);
		if (!siteIds) {
			console.log(chalk.red('searchspring.siteId object in package.json is empty'));
			exit();
		}

		multipleSites = siteIds
			.map((siteId) => {
				try {
					const { name } = context.searchspring.siteId[siteId];
					const secretKey = getSecretKeyFromCLI(siteId) || context.user.keys[siteId];

					if (!secretKey) {
						console.log(chalk.red(`Cannot find the secretKey for siteId '${siteId}'. Syncing to this site will be skipped.`));
						console.log(chalk.bold.white(`Please run the following command:`));
						console.log(chalk.gray(`snapfu secrets add`));
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
					exit();
				}
			})
			.filter((site) => site.secretKey);
	}

	return {
		dev: args['--dev'] || false,
		command: args._[0],
		args: args._.slice(1),
		options: {
			secretKey,
		},
		context,
		multipleSites,
	};
}

export async function cli(args) {
	const options = await parseArgumentsIntoOptions(args);

	switch (options.command) {
		case 'init':
			await init(options);
			break;

		case 'recs':
		case 'recommendation':
		case 'recommendations':
			{
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
			}

			break;

		case 'secret':
		case 'secrets':
			{
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
			}

			break;

		case 'login':
			await login(options);
			break;

		case 'org-access':
			orgAccess(options);
			break;

		case 'whoami':
			try {
				const user = await whoami();
				console.log(`${chalk.blue(user.name)} (${chalk.green(user.login)})`);
			} catch (err) {
				if (err === 'creds not found') {
					console.log('not logged in');
				} else {
					console.log(chalk.red(err));
				}
			}
			break;

		case 'about':
			about(options);
			break;

		default:
			help(options);
			break;
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
