import arg from 'arg';
import chalk from 'chalk';
import cmp from 'semver-compare';

import { login, orgAccess, whoami } from './login';
import { initTemplate, listTemplates, removeTemplate, syncTemplate } from './template';
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

	return {
		dev: args['--dev'] || false,
		command: args._[0],
		args: args._.slice(1),
		options: {
			secretKey: args['--secret-key'],
		},
		context: await getContext(),
	};
}

export async function cli(args) {
	let options = await parseArgumentsIntoOptions(args);

	await checkForLatestVersion(options);

	switch (options.command) {
		case 'init':
			init(options);
			break;

		case 'template':
		case 'templates':
			{
				function showTemplateHelp() {
					help({ command: 'help', args: ['template'] });
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
						removeTemplate(options);
						break;
			
					case 'sync':
						syncTemplate(options);
						break;
			
					default:
						showTemplateHelp();
						break;
				}
			}

			break;

		case 'login':
			login(options);
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
}

function debug(options, message) {
	if (options.dev) {
		console.log(message);
	}
}

async function checkForLatestVersion(options) {
	const latest = await commandOutput('npm view snapfu version');

	if (cmp(latest,options.context.version) == 1) {
		console.log(`${chalk.bold.grey(`Version ${chalk.bold.red(`${latest}`)} of snapfu available.\nInstall with:`)}\n`);
		console.log(`${chalk.bold.greenBright('npm install -g snapfu')}\n`);
		console.log(`${chalk.grey('─────────────────────────────────────────────')}\n`);
	}
}