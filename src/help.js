import chalk from 'chalk';

// generic help text
const rootText = `usage: snapfu ${chalk.grey('<' + chalk.underline('command') + '>')} ${chalk.green(
	'[' + chalk.underline('--option') + ']'
)} ${chalk.greenBright('<' + chalk.underline('value') + '>')}

These are the snapfu commands used in various situations

    ${chalk.whiteBright('init')} ${chalk.grey('<' + chalk.underline('directory') + '>')}          Creates a new snap project (optional directory)
    ${chalk.whiteBright('template')}                    Template management
    ${chalk.whiteBright('login')}                       Oauths with github
    ${chalk.whiteBright('org-access')}                  Review and change organization access for the tool
    ${chalk.whiteBright('whoami')}                      Shows the current user
    ${chalk.whiteBright('about')}                       Shows versioning
    ${chalk.whiteBright('help')} ${chalk.grey('<' + chalk.underline('command') + '>')}              Display help text (optional command)`;

// template help text
const templateText = `usage: snapfu template ${chalk.grey('<' + chalk.underline('command') + '>')} ${chalk.green(
	'[' + chalk.underline('--option') + ']'
)} ${chalk.greenBright('<' + chalk.underline('value') + '>')}

These are the snapfu template commands and options

    ${chalk.whiteBright('init')} ${chalk.grey('<' + chalk.underline('template') + '>')} ${chalk.grey(
	'<' + chalk.underline('path') + '>'
)}      Initialize template using defaults
    ${chalk.whiteBright('archive')} ${chalk.grey('<' + chalk.underline('template / all') + '>')}    Archive remote template
        ${chalk.green('--secret-key')} ${chalk.greenBright('<' + chalk.underline('key') + '>')}
        ${chalk.green('--branch')} ${chalk.greenBright('<' + chalk.underline('branch') + '>')}
    ${chalk.whiteBright('sync')} ${chalk.grey('<' + chalk.underline('template / all') + '>')}       Synchronize template and parameters with remote
        ${chalk.green('--secret-key')} ${chalk.greenBright('<' + chalk.underline('key') + '>')}
        ${chalk.green('--branch')} ${chalk.greenBright('<' + chalk.underline('branch') + '>')}`;

// help text mapping
const helpMap = {
	root: rootText,
	template: templateText,
	templates: templateText,
};

export const help = (options) => {
	const subject = options.args[0];
	const text = helpMap[subject] || helpMap.root;

	console.log(text);
};
