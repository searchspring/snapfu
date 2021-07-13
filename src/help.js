import chalk from 'chalk';

// generic help text
const rootText = `Usage: snapfu ${chalk.white('<' + chalk.underline('command') + '>')} ${chalk.grey(
	'<' + chalk.underline('args') + '>'
)} ${chalk.green('[' + chalk.underline('--options') + ']')}

These are the snapfu commands used in various situations

    ${chalk.whiteBright('init')} ${chalk.grey('<directory>')}              Creates a new snap project (optional directory)
    ${chalk.whiteBright('template')}                      Template management
    ${chalk.whiteBright('login')}                         Oauths with github
    ${chalk.whiteBright('org-access')}                    Review and change organization access for the tool
    ${chalk.whiteBright('whoami')}                        Shows the current user
    ${chalk.whiteBright('about')}                         Shows versioning
    ${chalk.whiteBright('help')} ${chalk.grey('<command>')}                Display help text (optional command)`;

// template help text
const templateText = `Usage: snapfu template ${chalk.white('<' + chalk.underline('command') + '>')} ${chalk.grey(
	'<' + chalk.underline('args') + '>'
)} ${chalk.green('[' + chalk.underline('--options') + ']')}

These are the snapfu template commands and options

    ${chalk.whiteBright('init')} ${chalk.grey('<template> <path>')}        Initialize template using defaults (optional path)
    ${chalk.whiteBright('list')} ${chalk.grey('[local | remote]')}         Display list of templates (local or remote)
    ${chalk.whiteBright('archive')} ${chalk.grey('<template> <branch>')}   Remove remote template (optional branch)
        ${chalk.green('--secret-key')} ${chalk.green('<key>')}
    ${chalk.whiteBright('sync')} ${chalk.grey('<template> <branch>')}      Synchronize template and parameters with remote (optional branch)
        ${chalk.green('--secret-key')} ${chalk.green('<key>')}`;

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
