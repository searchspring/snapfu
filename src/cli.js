import child_process from 'child_process';
import { promisify } from 'util';
import arg from 'arg';
import { login, orgAccess, whoami } from './login';
import { init } from './init';
import { about } from './about';
import { template } from './template';
import { help } from './help';
import chalk from 'chalk';

const exec = promisify(child_process.exec);

async function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--dev': Boolean,
			'--secret-key': String,
			'--branch': String,
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
			branch: args['--branch'],
			secretKey: args['--secret-key'],
		},
		context: await getContext(),
	};
}

export async function cli(args) {
	let options = await parseArgumentsIntoOptions(args);
	debug(options, options);

	switch (options.command) {
		case 'init':
			init(options);
			break;

		case 'template':
		case 'templates':
			template(options);
			break;

		case 'login':
			login(options);
			break;

		case 'org-access':
			orgAccess(options);
			break;

		case 'whoami':
			await whoami()
				.then((user) => {
					console.log(`${chalk.blue(user.name)} (${chalk.green(user.login)})`);
				})
				.catch((err) => {
					if (err === 'creds not found') {
						console.log('not logged in');
					} else {
						console.log(chalk.red(err));
					}
				});
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

async function commandOutput(cmd) {
	try {
		const { err, stdout, stderr } = await exec(cmd);
		if (err) throw 'error';

		return stdout.trim();
	} catch (err) {
		// cannot get branch details
	}
}

async function getContext() {
	// TODO get searchspring details from package.json
	const searchspring = {
		creator: 'searchspring',
		siteId: 'abc123',
		framework: 'preact',
		platform: 'custom',
		tags: [],
	};

	// get git stuff
	const repository = {
		remote: await commandOutput('git branch --show-current'),
		branch: await commandOutput('git config --get remote.origin.url'),
	};

	return {
		repository,
		searchspring,
	};
}
