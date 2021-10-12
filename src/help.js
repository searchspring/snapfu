import chalk from 'chalk';

// generic help text
const rootText = `Usage: snapfu ${chalk.white('<' + chalk.underline('command') + '>')} ${chalk.grey(
	'<' + chalk.underline('args') + '>'
)} ${chalk.green('[' + chalk.underline('--options') + ']')}

These are the snapfu commands used in various situations

    ${chalk.whiteBright('init')} ${chalk.grey('<directory>')}              Creates a new snap project (optional directory)
    ${chalk.whiteBright('recs')}                          Recommendation template management
    ${chalk.whiteBright('secrets')}                       Project secret management
    ${chalk.whiteBright('login')}                         Oauths with github
    ${chalk.whiteBright('org-access')}                    Review and change organization access for the tool
    ${chalk.whiteBright('whoami')}                        Shows the current user
    ${chalk.whiteBright('about')}                         Shows versioning
    ${chalk.whiteBright('help')} ${chalk.grey('<command>')}                Display help text (optional command)`;

// recommendation template help text
const recommendationText = `Usage: snapfu recs ${chalk.white('<' + chalk.underline('command') + '>')} ${chalk.grey(
	'<' + chalk.underline('args') + '>'
)} ${chalk.green('[' + chalk.underline('--options') + ']')}

These are the snapfu recommendation template commands and options

    ${chalk.whiteBright('init')} ${chalk.grey('<name> <path>')}            Initialize recommendation template using defaults (optional path)
    ${chalk.whiteBright('list')} ${chalk.grey('[local | remote]')}         Display list of recommendation templates (local or remote)
    ${chalk.whiteBright('archive')} ${chalk.grey('<name> <branch>')}       Remove remote recommendation template (optional branch)
        ${chalk.green('--secret-key')} ${chalk.green('<key>')}
    ${chalk.whiteBright('sync')} ${chalk.grey(
	'<name> <branch>'
)}          Synchronize recommendation template and parameters with remote (optional branch)
        ${chalk.green('--secret-key')} ${chalk.green('<key>')}`;

// secrets help text
const secretText = `Usage: snapfu secrets ${chalk.white('<' + chalk.underline('command') + '>')} ${chalk.grey(
	'<' + chalk.underline('args') + '>'
)} ${chalk.green('[' + chalk.underline('--options') + ']')}

These are the snapfu secrets commands

    ${chalk.whiteBright('add')}                           Adds secrets to snap project
    ${chalk.whiteBright('update')}                        Update secrets in snap project
    ${chalk.whiteBright('verify')}                        Verify secrets in snap project
    ${chalk.whiteBright('help')} ${chalk.grey('<command>')}                Display help text (optional command)`;

// help text mapping
const helpMap = {
	root: rootText,
	recs: recommendationText,
	recommendation: recommendationText,
	recommendations: recommendationText,
	secret: secretText,
	secrets: secretText,
};

export const help = (options) => {
	const subject = options.args[0];
	const text = helpMap[subject] || helpMap.root;

	console.log(text);
};
