import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import fs, { promises as fsp } from 'fs';
import { exit } from 'process';
import { help } from './help.js';
import { wait } from './utils/index.js';
import { DEFAULT_BRANCH } from './init.js';
import { frameworks } from './frameworks/index.js';
import { ConfigApi } from './services/ConfigApi.js';

const TEMPLATE_TYPE_RECS = 'snap/recommendation';
const DIR_BLACK_LIST = ['node_modules', '.git'];

function showTemplateHelp() {
	help({ command: 'help', args: ['template'] });
}

export async function initTemplate(options) {
	const { context } = options;
	const { searchspring } = context;
	const [command, ...nameArgs] = options.args;
	const nameArg = nameArgs.join(' ');

	if (!searchspring || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!searchspring.framework || !frameworks[searchspring.framework]) {
		console.log(chalk.red(`Error: No path specified and unknown Snap framework.`));
		return;
	}

	if (nameArg && nameArg.length < 3) {
		console.log(chalk.red(`Error: Template name must be greater than two characters in length.`));
		return;
	}

	const framework = frameworks[searchspring.framework];
	const templateDefaultDir = path.resolve(context.project.path, framework.template.dir);
	let answers1;
	if (!nameArg) {
		answers1 = await inquirer.prompt([
			{
				type: 'input',
				name: 'name',
				message: 'Please enter the name of the template:',
				validate: (input) => {
					return input && input.length > 2;
				},
			},
		]);
	}

	let answers2 = await inquirer.prompt([
		{
			type: 'input',
			name: 'description',
			message: 'Please enter a description for the template:',
		},
		{
			type: 'input',
			name: 'directory',
			message: 'Please specify the path to initialize the template files (relative to project directory):',
			validate: (input) => {
				return input && input.length > 0;
			},
			default: framework.template.dir,
		},
		{
			type: 'list',
			name: 'type',
			message: 'Please select the type of recommendations:',
			choices: Object.keys(framework.template.components),
			default: 'default',
		},
	]);

	console.log(`Initializing template...`);

	let answers = { ...answers1, ...answers2 };

	const name = nameArg || answers.name;
	const description = answers && answers.description;
	const templateDir = (answers && answers.directory) || templateDefaultDir;
	const componentName = pascalCase(name);

	const settings = {
		type: `${TEMPLATE_TYPE_RECS}/${answers.type}`,
	};

	try {
		await writeTemplateFile(
			path.resolve(process.cwd(), templateDir, `${componentName}.json`),
			generateTemplateSettings({ name, description, type: settings.type })
		);
		if (framework) {
			await writeTemplateFile(
				path.resolve(process.cwd(), templateDir, `${componentName}.jsx`),
				framework.template.components[answers.type](componentName)
			);
			await writeTemplateFile(
				path.resolve(process.cwd(), templateDir, `${componentName}.scss`),
				framework.template.styles[answers.type](componentName)
			);
		}
	} catch (err) {
		console.log(chalk.red(`Error: Failed to initialize template.`));
		console.log(err);
	}
}

export async function listTemplates(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, location] = options.args;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!location || location == 'local') {
		console.log(`${chalk.white('Local Templates')}`);

		console.log(`${chalk.white.bold(`    ${repository.name}`)}`);

		const templates = await getTemplates(context.project.path);

		if (!templates || !templates.length) {
			console.log(chalk.italic('        no templates found...'));
		} else {
			templates.forEach((template, index) => {
				console.log(
					`        ${chalk.green(template.details.name)} ${repository.branch ? chalk.blue(`[${repository.branch}]`) : ''} ${chalk.gray.italic(
						`(${template.path})`
					)}`
				);
			});
		}
	}

	if (!location || location == 'remote') {
		if (!location) {
			console.log();
		}

		console.log(`${chalk.white('Active Remote Templates (SMC)')}`);

		let smcManaged;

		const list = async (secretKey, siteId = '', name = '') => {
			const remoteTemplates = await new ConfigApi(secretKey, options.dev).getTemplates();

			if (siteId && name) {
				console.log(`${chalk.white.bold(`    ${name} ${chalk.cyan(`(${siteId})`)}`)}`);
			}

			if (!remoteTemplates || !remoteTemplates.recommendTemplates || !remoteTemplates.recommendTemplates.length) {
				console.log(chalk.italic('        no templates found...'));
			} else {
				remoteTemplates.recommendTemplates.forEach((template) => {
					if (!template.managed) {
						smcManaged = true;
					}

					const [name, branch] = template.name.split('__');

					console.log(
						`        ${template.managed ? '' : `${chalk.yellow('*')} `}${chalk.green(name)} ${
							branch ? chalk.blue(`[${branch}]`) : ''
						} ${chalk.gray.italic(
							`(https://manage.searchspring.net/management/product-recs-templates/template-version-edit?template_name=${template.name})`
						)}`
					);
				});
			}
		};

		try {
			if (options.multipleSites.length) {
				for (let i = 0; i < options.multipleSites.length; i++) {
					const { secretKey, siteId, name } = options.multipleSites[i];
					await list(secretKey, siteId, name);
					if (i < options.multipleSites.length - 1) console.log();
				}
			} else {
				const { secretKey } = options.options;
				await list(secretKey, options.context.searchspring.siteId, options.context.repository.name);
			}

			if (smcManaged) {
				console.log(`\n${chalk.yellow('* manually managed in the SMC')}`);
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

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!templateName) {
		console.log(chalk.red(`Template name is required.`));
		return;
	}

	const branchName = branch || repository.branch || DEFAULT_BRANCH;
	if (repository && repository.branchList && !repository.branchList.includes(branchName)) {
		console.log(chalk.red(`Error: Branch not found. - ${branch}`));
		return;
	}

	const payload = { name: templateName, branch: branchName };

	const remove = async (secretKey) => {
		try {
			// using fancy terminal output replacement
			process.stdout.write(`${chalk.green(`        ${templateName}`)} ${chalk.blue(`[${branchName}]`)}`);

			await new ConfigApi(secretKey, options.dev).archiveTemplate(payload);

			process.stdout.write(chalk.gray.italic(' - archived in remote'));
		} catch (err) {
			process.stdout.write(chalk.red.italic(' - archived failed'));
			console.log('        ', chalk.red(err));
		}

		await wait(100);
	};

	if (options.multipleSites.length) {
		for (let i = 0; i < options.multipleSites.length; i++) {
			const { secretKey, siteId, name } = options.multipleSites[i];

			console.log(`${chalk.white.bold(`${name} ${chalk.cyan(`(${siteId})`)}`)}`);
			// console.log(`    archiving template`);
			await remove(secretKey);
		}
	} else {
		const { secretKey } = options.options;
		console.log(`${chalk.white.bold(`${repository.name}`)}`);
		await remove(secretKey);
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
		//lets validate all the details are valid before we sync
		let invalidParam;
		Object.keys(template.details).forEach(function (detail) {
			if (typeof template.details[detail] !== 'string') {
				if (detail == 'parameters') {
					template.details[detail].map((index) => {
						Object.keys(index).forEach(function (parameters) {
							if (typeof index[parameters] !== 'string') {
								invalidParam = `${detail}: { ${parameters}: ${index[parameters]} }`;
							}
						});
					});
				} else {
					invalidParam = `${detail} ${template.details[detail]}`;
				}
			}
		});

		if (invalidParam) {
			console.log(
				chalk.red(`
Error: Invalid template configuration found on template ${chalk.white.underline(template.details.name)}!`)
			);
			console.log(
				chalk.cyanBright(`
			
${invalidParam}
			
			`)
			);
			console.log(
				chalk.whiteBright(`Please ensure all template config values are strings.
		
			`)
			);
			//Stop everything
			exit(1);
		} else {
			if (templateName) {
				if (template.details.name == templateName) return template;
			} else {
				return template;
			}
		}
	});

	if (!syncTemplates.length) {
		console.log(chalk.red(`Error: Template(s) not found.`));
		return;
	}

	const branchName = branch || repository.branch || DEFAULT_BRANCH;
	if (repository && repository.branchList && !repository.branchList.includes(branchName)) {
		console.log(chalk.red(`Error: Branch not found. - ${branch}`));
		return;
	}

	const sync = async (template, secretKey) => {
		const payload = buildTemplatePayload(template.details, { branch: branchName, framework: searchspring.framework });

		if (payload.name && !payload.name.match(/^[a-zA-Z0-9_-]*$/)) {
			console.log(chalk.red(`Error: Template name must be an alphanumeric string (underscore and dashes also supported).`));
			return;
		}

		try {
			await new ConfigApi(secretKey, options.dev).putTemplate(payload);
			console.log(
				chalk.green(`        ${template.details.name}`),
				chalk.blue(`[${branchName}]`),
				chalk.gray.italic(
					`(https://manage.searchspring.net/management/product-recs-templates/template-version-edit?template_name=${payload.name}__${branchName})`
				)
			);
		} catch (err) {
			console.log(chalk.red(`        ${template.details.name}`), chalk.blue(`[${branchName}]`));
			console.log('        ', chalk.red(err));
			exit(1);
		}

		// prevent rate limiting
		await wait(100);
	};

	if (options.multipleSites.length) {
		for (let x = 0; x < options.multipleSites.length; x++) {
			const { secretKey, siteId, name } = options.multipleSites[x];

			console.log(`${chalk.white.bold(`${name} ${chalk.cyan(`(${siteId})`)}`)}`);
			for (let i = 0; i < syncTemplates.length; i++) {
				const template = syncTemplates[i];
				console.log(`    synchronizing template ${i + 1} of ${syncTemplates.length}`);

				await sync(template, secretKey);
			}

			if (x < options.multipleSites.length - 1) console.log();
		}
	} else {
		console.log(`${chalk.white.bold(`${repository.name}`)}`);
		for (let i = 0; i < syncTemplates.length; i++) {
			const template = syncTemplates[i];
			console.log(`    synchronizing template ${i + 1} of ${syncTemplates.length}`);
			await sync(template, secretKey);
		}
	}
}

export function generateTemplateSettings({ name, description, type }) {
	let settings = {
		type,
		name: handleize(name),
		label: name,
		description: description || `${name} custom template`,
		component: `${pascalCase(name)}`,
	};
	if (type.indexOf('email') == -1) {
		settings = {
			...settings,
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
	}

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
					template.details.type &&
					template.details.type.startsWith(TEMPLATE_TYPE_RECS) &&
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

export async function writeTemplateFile(filePath, contents) {
	const baseDir = path.dirname(filePath);

	await fsp.mkdir(baseDir, { recursive: true });

	try {
		const exists = await fsp.stat(filePath);
		console.log(chalk.yellow(`File already exists: ${filePath}`));
	} catch (err) {
		console.log(chalk.green(`Creating file: ${filePath}`));
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
		type: template.type,
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
				type: template.type.replace(TEMPLATE_TYPE_RECS, '').replace('/', '') || 'default',
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

export function pascalCase(string) {
	return `${string}`
		.replace(new RegExp(/[-_]+/, 'g'), ' ')
		.replace(new RegExp(/[^\w\s]/, 'g'), '')
		.replace(new RegExp(/\s+(.)(\w*)/, 'g'), ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`)
		.replace(new RegExp(/\w/), (s) => s.toUpperCase());
}

export function handleize(input) {
	if (typeof input != 'string') {
		return input;
	}

	let handleized = input.toLowerCase();
	handleized = handleized.replace(/[^\w\s]/g, '').trim();
	handleized = handleized.replace(/\s/g, '-');
	return handleized;
}

export async function timeout(microSeconds) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, microSeconds);
	});
}
