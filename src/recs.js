import chalk from 'chalk';
import path from 'path';
import fs, { promises as fsp } from 'fs';
import { help } from './help';
import { frameworks } from './frameworks';
import { ConfigApi } from './services/ConfigApi';

const TEMPLATE_TYPE_RECS = 'snap/recommendation';
const DIR_BLACK_LIST = ['node_modules', '.git'];

function showTemplateHelp() {
	help({ command: 'help', args: ['template'] });
}

export async function initTemplate(options) {
	const { context } = options;
	const { searchspring } = context;
	const [command, name, dir] = options.args;

	console.log(`Initializing template...`);

	if (name && !name.match(/^[a-zA-Z0-9_]*$/)) {
		console.log(chalk.red(`Error: Template name must be an alphanumeric string.`));
		return;
	}

	const componentName = capitalizeFirstLetter(name);

	if (!searchspring || !context.project.path) {
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
	const templateDir = dir || path.resolve(context.project.path, framework.template.dir);

	try {
		await writeTemplateSettings(path.resolve(process.cwd(), templateDir, `${componentName}.json`), generateTemplateSettings(name));
		if (framework) {
			await writeTemplateSettings(path.resolve(process.cwd(), templateDir, `${componentName}.jsx`), framework.template.component(componentName));
		}
	} catch (err) {
		console.log(chalk.red(`Error: Failed to initialize template.`));
		console.log(err);
	}
}

export async function listTemplates(options) {
	const { context } = options;
	const { searchspring } = context;
	const { branch } = context.repository;
	const [command, location] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!location || location == 'local') {
		console.log(`${chalk.grey('Local Templates')}`);

		const templates = await getTemplates(context.project.path);

		if (!templates || !templates.length) {
			console.log(chalk.italic('no templates found...'));
		} else {
			templates.forEach((template, index) => {
				console.log(`${chalk.green(template.details.name)} ${branch ? `[${branch}]` : ''} ${chalk.blueBright(`(${template.path})`)}`);
			});
		}
	}

	if (!location || location == 'remote') {
		if (!location) {
			console.log();
		}

		console.log(`${chalk.grey('Remote Templates (SMC)')}`);

		if (!secretKey) {
			console.log(chalk.red(`Unauthorized: Please provide secretKey.`));
			return;
		}

		try {
			const remoteTemplates = await new ConfigApi(secretKey, options.dev).getTemplates();

			if (!remoteTemplates || !remoteTemplates.recommendTemplates || !remoteTemplates.recommendTemplates.length) {
				console.log(chalk.italic('no templates found...'));
			} else {
				let smcManaged;

				remoteTemplates.recommendTemplates.forEach((template, index) => {
					if (!template.managed) smcManaged = true;

					const [name, branch] = template.name.split('__');

					console.log(
						`${template.managed ? '' : `${chalk.yellow('*')} `}${chalk.green(name)} ${branch ? `[${branch}]` : ''} ${chalk.blueBright(
							`(https://manage.searchspring.net/management/product-recs-templates/template-version-edit?template_name=${template.name})`
						)}`
					);
				});

				if (smcManaged) {
					console.log(`\n${chalk.yellow('* manually managed in the SMC')}`);
				}
			}
		} catch (err) {
			console.log(chalk.red(err));
		}
	}
}

export async function removeTemplate(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, templateName, branch] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!templateName) {
		console.log(chalk.red(`Template name is required.`));
		return;
	}

	const branchName = branch || repository.branch || 'production';

	const payload = { name: templateName, branch: branchName };

	try {
		process.stdout.write('archiving...   ');
		await new ConfigApi(secretKey, options.dev).archiveTemplate(payload);
		console.log(chalk.green(`${templateName}`), chalk.white(`[${branchName}]`));
		console.log(chalk.green('Template archived in remote.'));
	} catch (err) {
		console.log(chalk.red(`${templateName}`), chalk.white(`[${branchName}]`));
		console.log(chalk.red(err));
	}
}

export async function syncTemplate(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, templateName, branch] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	const templates = await getTemplates(context.project.path);
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

		try {
			process.stdout.write('synchronizing...   ');
			await new ConfigApi(secretKey, options.dev).putTemplate(payload);
			console.log(chalk.green(`${template.details.name}`), chalk.white(`[${branchName}]`));
		} catch (err) {
			console.log(chalk.red(`${template.details.name}`), chalk.white(`[${branchName}]`));
			console.log(chalk.red(err));
		}

		// prevent rate limiting
		await wait(1111);
	}
}

export function generateTemplateSettings(name) {
	const settings = {
		type: TEMPLATE_TYPE_RECS,
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

export async function getTemplates(dir) {
	try {
		const files = await findJsonFiles(dir);
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
				if (
					typeof template.details == 'object' &&
					template.details.type == TEMPLATE_TYPE_RECS &&
					template.details.name &&
					template.details.label &&
					template.details.component
				) {
					return template;
				}
			});
	} catch (err) {
		console.log(err);
		return [];
	}
}

export async function writeTemplateSettings(filePath, contents) {
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

export async function readTemplateSettings(filePath) {
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

export async function findJsonFiles(dir) {
	// get all JSON files (exclude looking in blacklist)
	try {
		const details = await fsp.stat(dir);
		if (!details || !details.isDirectory) {
			throw 'Directory not provided.';
		}

		let templateFiles = [];

		const contents = await fsp.readdir(dir);
		const readPromises = contents
			.filter((file) => {
				const filePath = path.resolve(dir, file);
				try {
					const fileStats = fs.statSync(filePath);

					if (!fileStats.isSymbolicLink() && fileStats.isDirectory() && !DIR_BLACK_LIST.includes(file)) {
						return file;
					} else if (file.match(/\.json$/)) {
						templateFiles.push(filePath);
					}
				} catch (err) {
					// not doing anything currently...
				}
			})
			.map((file) => {
				return findJsonFiles(path.resolve(dir, file));
			});

		const dirContents = await Promise.all(readPromises);

		return [...templateFiles, ...dirContents.flat(1)];
	} catch (err) {
		console.log(chalk.red(`Error: cannot find templates in: ${dir}`));
		throw err;
	}
}

export function buildTemplatePayload(template, vars) {
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

export function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

export async function timeout(microSeconds) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, microSeconds);
	});
}

function wait(us) {
	return new Promise((resolve) => {
		setTimeout(resolve, us);
	});
}
