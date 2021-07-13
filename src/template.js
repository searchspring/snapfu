import chalk from 'chalk';
import fetch from 'node-fetch';
import path from 'path';
import fs, { promises as fsp } from 'fs';
import { help } from './help';
import { frameworks } from './frameworks';

const apiHost = 'https://smc-config-api.kube.searchspring.io';
const devApiHost = 'http://localhost:9999';
const DIR_BLACK_LIST = ['node_modules', '.git'];

export const template = async (options) => {
	if (!options.args.length) {
		showTemplateHelp();
		return;
	}

	const [command] = options.args;

	switch (command) {
		case 'init':
			await initTemplate(options);
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
};

function showTemplateHelp() {
	help({ command: 'help', args: ['template'] });
}

async function initTemplate(options) {
	const { context } = options;
	const { searchspring } = context;
	const [command, name, dir] = options.args;

	if (!name) {
		showTemplateHelp();
		return;
	}

	console.log(chalk.grey(`Initializing template...`));

	if (name && !name.match(/^[a-zA-Z0-9_]*$/)) {
		console.log(chalk.red(`Error: Template name must be an alphanumeric string.`));
		return;
	}

	const componentName = capitalizeFirstLetter(name);

	if (!searchspring || !context.local.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!dir) {
		if (!searchspring.framework || !frameworks[searchspring.framework]) {
			console.log(chalk.red(`Error: No path specified and unknown Snap framework.`));
			return;
		} else {
			console.log(chalk.grey(`No path specified. Using defaults for ${searchspring.framework}.`));
		}
	}

	const framework = frameworks[searchspring.framework];
	const templateDir = dir || path.resolve(context.local.path, framework.template.dir);

	try {
		await writeTemplateFile(path.resolve(process.cwd(), templateDir, componentName, `${componentName}.json`), generateTemplateSettings(name));
		if (framework) {
			await writeTemplateFile(
				path.resolve(process.cwd(), templateDir, componentName, `${componentName}.jsx`),
				framework.template.component(componentName)
			);
		}
	} catch (err) {
		console.log(chalk.red(`Error: Failed to initialize template.`));
		console.log(err);
	}
}

async function listTemplates(options) {
	const { context } = options;
	const { searchspring } = context;
	const [command, location] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.local || !context.local.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!location || location == 'local') {
		const templates = await getTemplates(context.local.path);

		templates.forEach((template, index) => {
			console.log(`${chalk.green(template.details.name)} (${template.details.label})`);
			console.log(`${chalk.grey(template.details.description)}`);
			if (templates.length - 1 != index) {
				console.log();
			}
		});
	} else if (location == 'remote') {
		if (!secretKey) {
			console.log(chalk.red(`Unauthorized: Provide secretKey.`));
			return;
		}

		const apiPath = `${options.dev ? devApiHost : apiHost}/api/recsTemplates`;

		try {
			const response = await fetch(apiPath, { method: 'get', headers: { Accept: 'application/json', Authorization: secretKey } });

			if (response.status == 200) {
				const remoteTemplates = await response.json();
				remoteTemplates.recommendTemplates.forEach((template, index) => {
					const [name, branch] = template.name.split('__');
					console.log(`${chalk.green(name)} ${branch ? `[${branch}]` : ''}`);
					if (remoteTemplates.length - 1 != index) {
						console.log();
					}
				});
			} else if (response.status == 401) {
				console.log(chalk.red(`Unauthorized: Please verify secretKey.`));
			} else if (response.status == 405) {
				console.log(chalk.red(`Error: Server method not allowed.`));
			} else if (response.status == 500) {
				console.log(chalk.red(`Server encounterd a problem.`));
			} else {
				console.log(chalk.red(`Unknown error has occured.`));
			}
		} catch (err) {
			console.log(chalk.red(`Failed to connect to: ${apiPath}`));
		}
	}
}

async function removeTemplate(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, templateName, branch] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.local || !context.local.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	const payload = { name: templateName, branch: branch || repository.branch || 'production' };

	const apiPath = `${options.dev ? devApiHost : apiHost}/api/recsTemplate`;

	try {
		const response = await fetch(apiPath, {
			method: 'delete',
			body: JSON.stringify(payload),
			headers: { Accept: 'application/json', Authorization: secretKey },
		});

		if (response.status == 200) {
			console.log(chalk.green(`${templateName}`), chalk.white(`[${payload.branch}]`));
			console.log(chalk.green('Template removed from remote.'));
		} else if (response.status == 401) {
			console.log(chalk.red(`Unauthorized: Please verify secretKey.`));
		} else if (response.status == 404) {
			console.log(chalk.green(`${templateName}`), chalk.white(`[${payload.branch}]`));
			console.log(chalk.red(`Template not found. Ensure correct branch and template name is specified.`));
		} else if (response.status == 405) {
			console.log(chalk.red(`Error: Server method not allowed.`));
		} else if (response.status == 500) {
			console.log(chalk.red(`Server encounterd a problem.`));
		} else {
			console.log(chalk.red(`Unknown error has occured.`));
		}
	} catch (err) {
		console.log(chalk.red(`Failed to connect to: ${apiPath}`));
	}
}

async function syncTemplate(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, templateName, branch] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.local || !context.local.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	const templates = await getTemplates(context.local.path);
	const syncTemplates = templates.filter((template) => {
		if (templateName) {
			if (template.details.name == templateName) return template;
		} else {
			return template;
		}
	});

	if (!syncTemplates.length) {
		console.log(chalk.red(`Error: Templates not found.`));
		return;
	}

	const branchName = branch || repository.branch || 'production';

	for (let i = 0; i < syncTemplates.length; i++) {
		const template = syncTemplates[i];
		const payload = buildTemplatePayload(template.details, { branch: branchName, framework: searchspring.framework });

		const apiPath = `${options.dev ? devApiHost : apiHost}/api/recsTemplate`;

		try {
			const response = await fetch(apiPath, {
				method: 'put',
				body: JSON.stringify(payload),
				headers: { Accept: 'application/json', Authorization: secretKey },
			});

			console.log(chalk.green(`${template.details.name}`), chalk.white(`[${branchName}]`));

			if (response.status == 200) {
				console.log(chalk.green('Synchronization with remote complete.'));
			} else if (response.status == 400) {
				console.log(chalk.red(`Error: Problem with payload.`));
			} else if (response.status == 401) {
				console.log(chalk.red(`Unauthorized: Please verify secretKey.`));
			} else if (response.status == 405) {
				console.log(chalk.red(`Error: Server method not allowed.`));
			} else if (response.status == 500) {
				console.log(chalk.red(`Server encounterd a problem.`));
			} else {
				console.log(chalk.red(`Unknown error has occured.`));
			}

			if (i != syncTemplates.length - 1) {
				console.log(`${chalk.grey('─────────────────────────────────────────────')}\n`);
				console.log();
				await timeout(1111);
			}
		} catch (err) {
			console.log(chalk.red(`Failed to connect to: ${apiPath}`));
			break;
		}
	}
}

function generateTemplateSettings(name) {
	const settings = {
		name: name.toLowerCase(),
		label: `${name}`,
		description: `${name} custom template.`,
		component: `${capitalizeFirstLetter(name)}`,
		orientation: 'horizontal',
		parameters: [
			{
				name: 'title',
				label: 'Title',
				description: 'text used for the heading',
				defaultValue: 'Recommended Products',
			},
		],
	};

	return JSON.stringify(settings, null, '\t');
}

async function writeTemplateFile(filePath, contents) {
	const baseDir = path.dirname(filePath);

	await fsp.mkdir(baseDir, { recursive: true });

	try {
		const exists = await fsp.stat(filePath);
		console.log(chalk.yellow(`File already exists: ${filePath}`));
	} catch (err) {
		console.log(chalk.greenBright(`Creating file: ${filePath}`));
		await fsp.writeFile(filePath, contents, 'utf8');
	}
}

async function readTemplateSettings(filePath) {
	let fileContents;

	try {
		fileContents = await fsp.readFile(filePath, 'utf8');
	} catch (err) {
		console.log(chalk.red(`Error: Failed to read file: ${filePath}`));
		fileContents = '';
	}

	try {
		const fileParsed = JSON.parse(fileContents);
		return fileParsed;
	} catch (err) {
		console.log(chalk.red(`Error: invalid JSON in file: ${filePath}`));
		return {};
	}
}

async function getTemplates(dir) {
	try {
		const files = await findTemplateFiles(dir);
		const fileReads = files.map((filePath) => readTemplateSettings(filePath));
		const fileContents = await Promise.all(fileReads);

		return fileContents
			.map((template, index) => {
				return {
					path: files[index],
					details: template,
				};
			})
			.filter((template) => {
				if (typeof template.details == 'object' && template.details.name && template.details.label && template.details.component) {
					return template;
				}
			});
	} catch (err) {
		console.log(err);
	}
}

async function findTemplateFiles(dir) {
	// get all JSON files (exclude node_modules)
	// filter out only files with name same as parent directory
	try {
		const details = await fsp.stat(dir);
		if (!details.isDirectory) {
			throw 'Directory not provided.';
		}

		let templateFiles = [];

		const contents = await fsp.readdir(dir);
		const readPromises = contents
			.filter((file) => {
				const filePath = path.resolve(dir, file);

				if (fs.statSync(filePath).isDirectory() && !DIR_BLACK_LIST.includes(file)) {
					return file;
				} else if (file.match(/\.json$/)) {
					const parentDir = path.dirname(filePath).split(path.sep).pop();
					const fileName = file.replace(/\.json$/, '');

					if (fileName == parentDir) {
						templateFiles.push(filePath);
					}
				}
			})
			.map((file) => {
				return findTemplateFiles(path.resolve(dir, file));
			});

		const dirContents = await Promise.all(readPromises);

		return [...templateFiles, ...dirContents.flat(1)];
	} catch (err) {
		console.log(chalk.red(`Error: cannot find templates in: ${dir}`));
		throw err;
	}
}

function buildTemplatePayload(template, vars) {
	return {
		name: template.name,
		component: template.component,
		meta: {
			searchspringTemplate: {
				type: 'snap',
				label: template.label,
				description: template.description,
			},
			searchspringTemplateSnap: {
				branch: vars.branch,
				group: template.name,
				framework: vars.framework || 'unknown',
				managed: 'true',
			},
			searchspringRecommendProfile: {
				label: template.label,
				description: template.description,
				orientation: template.orientation || 'horizontal',
			},
		},
		parameters: template.parameters,
	};
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

async function timeout(microSeconds) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, microSeconds);
	});
}
