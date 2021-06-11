import chalk from 'chalk';
import { help } from './help';

export const template = (options) => {
	if (!options.args.length) {
		showTemplateHelp();
		return;
	}

	const [command] = options.args;

	switch (command) {
		case 'init':
			initTemplate(options);
			break;

		case 'archive':
			archiveTemplate(options);
			break;

		case 'sync':
			syncTemplate(options);
			break;

		default:
			showTemplateHelp();
			break;
	}
};

function showTemplateHelp() {
	help({ command: 'help', args: ['template'] });
}

function initTemplate(options) {
	const [command, name, path = 'no path specified'] = options.args;
	if (!name) {
		showTemplateHelp();
	}

	console.log(`initializing '${name}' template to: ${path}`);
}

function archiveTemplate(options) {}

function syncTemplate(options) {}

function generateTemplateSettings(name) {
	return {
		name,
		label: `${name} template`,
		description: `${namme} template`,
		component: 'Recommendations',
		orientation: 'horizontal',
		parameters: [
			{
				name: 'title',
				label: 'Title',
				description: 'shows the title',
				defaultValue: 'Recommended Products',
			},
		],
	};
}
