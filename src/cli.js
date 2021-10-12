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

						if (!name) {
							showTemplateHelp();
						} else {
							await initTemplate(options);
						}

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
