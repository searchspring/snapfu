import arg from 'arg';
import inquirer from 'inquirer';
import { login, orgAccess, whoami } from './login';
import { init } from './init';
import chalk from 'chalk';

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--dev': Boolean,
		},
		{
			argv: rawArgs.slice(2),
		}
	);
	return {
		dev: args['--dev'] || false,
		command: args._[0],
	};
}

export async function cli(args) {
	let options = parseArgumentsIntoOptions(args);
	if (!options.command || options.command === 'help') {
		displayHelp();
		return;
	}
	debug(options, options);
	if (options.command === 'login') {
		login(options);
	}
	if (options.command === 'org-access') {
		orgAccess(options);
	}
	if (options.command === 'init') {
		init(options);
	}
	if (options.command === 'whoami') {
		await whoami()
			.then((user) => {
				console.log(chalk.green(user));
			})
			.catch((err) => {
				if (err === 'creds not found') {
					console.log('not logged in');
				} else {
					console.log(chalk.red(err));
				}
			});
	}
}
function debug(options, message) {
	if (options.dev) {
		console.log(message);
	}
}

// loadCreds()

function displayHelp() {
	console.log(`usage: snapfu <command>
    
These are the snapfu commnads used in various situations

    login       Oauths with github
    whoami      Shows the current user
    org-access  Review and change organization access for the tool
    init        Creates a new snap project`);
}
