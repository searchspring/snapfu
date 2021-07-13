import child_process from 'child_process';
import { promisify } from 'util';
import arg from 'arg';
import { login, orgAccess, whoami } from './login';
import { init } from './init';
import { about } from './about';
import { template } from './template';
import { help } from './help';
import path from 'path';
import { promises as fsp } from 'fs';
import chalk from 'chalk';
import packageJSON from '../package.json';

const exec = promisify(child_process.exec);

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
			branch: args['--branch'],
			secretKey: args['--secret-key'],
		},
		context: await getContext(),
	};
}

export async function cli(args) {
	let options = await parseArgumentsIntoOptions(args);
	debug(options, options);

	await checkForLatestVersion(options);

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
	try {
		const user = await whoami();
		const { searchspring, local } = await getPackageJSON();

		// get git stuff
		const repository = {
			branch: await commandOutput('git branch --show-current'),
			remote: await commandOutput('git config --get remote.origin.url'),
		};

		return {
			user,
			local,
			repository,
			searchspring,
			version: packageJSON.version,
		};
	} catch (err) {
		throw err;
	}
}

async function checkForLatestVersion(options) {
	const latest = await commandOutput('npm view snapfu version');

	if (options.context.version != latest) {
		console.log(`${chalk.bold.grey(`Version ${chalk.bold.red(`${latest}`)} of snapfu available.\nInstall with:`)}\n`);
		console.log(`${chalk.bold.greenBright('npm -ig snapfu')}\n`);
		console.log(`${chalk.grey('─────────────────────────────────────────────')}\n\n`);
	}
}

async function getPackageJSON() {
	try {
		const [packageFile] = await getFiles(process.cwd(), 'package.json');

		if (packageFile) {
			const contents = await fsp.readFile(packageFile, 'utf8');
			const parsedContents = JSON.parse(contents);

			parsedContents.local = {
				path: path.dirname(packageFile),
				dirname: path.basename(path.dirname(packageFile)),
			};

			return parsedContents;
		}

		return {};
	} catch (err) {
		throw err;
	}
}

async function getFiles(dir, fileName) {
	const rootDir = path.parse(process.cwd()).root;
	let results = [];

	try {
		const dirFiles = await fsp.readdir(dir);

		for (const file of dirFiles) {
			const filePath = path.resolve(dir, file);

			if (file == fileName) {
				results.push(filePath);
			}
		}

		if (!results.length && dir != rootDir) {
			const dirResults = await getFiles(path.resolve(dir, '../'), fileName);
			results = results.concat(dirResults);
		}
	} catch (err) {
		throw new Error('failed to getFiles!');
	}

	return results;
}
