import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import fs, { promises as fsp } from 'fs';
import { exit } from 'process';
import { wait, copy, copyTransform, pascalCase, handleize } from './utils/index.js';
import { ConfigApi } from './services/ConfigApi.js';
import { buildLibrary } from './library.js';

const TEMPLATE_TYPE_BADGES = 'snap/badge';
const DIR_EXCLUDE_LIST = ['node_modules', '.git'];
const LOCATIONS_FILE = 'locations.json';

export async function initBadgeTemplate(options) {
	const { context } = options;
	const { searchspring } = context;
	const [command, ...nameArgs] = options.args;
	const nameArg = nameArgs.join(' ');

	if (!searchspring || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	// fetch library contents
	const library = await buildLibrary(options);

	if (!searchspring.framework || !library[searchspring.framework]) {
		console.log(chalk.red(`Error: No path specified and unknown Snap framework.`));
		return;
	}

	if (nameArg && nameArg.length < 3) {
		console.log(chalk.red(`Error: Template name must be greater than two characters in length.`));
		return;
	}

	const framework = library[searchspring.framework];

	if (!framework?.components?.badge) {
		console.log(chalk.red(`Error: Library does not contain badge components.`));
		return;
	}

	const templateDefaultDir = path.resolve(context.project.path, options.config.directories.components.badge);
	const answers1 = await inquirer.prompt([
		{
			type: 'list',
			name: 'type',
			message: 'Please select the type of badge:',
			choices: Object.keys(framework.components.badge),
			default: 'default',
		},
	]);

	let answers2;
	if (!nameArg) {
		answers2 = await inquirer.prompt([
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

	const name = nameArg || answers2.name;
	const componentName = pascalCase(name);

	const answers3 = await inquirer.prompt([
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
			default: path.join(options.config.directories.components.badge, componentName),
		},
	]);

	console.log(`\nInitializing template...`);

	const answers = { ...answers1, ...answers2, ...answers3 };

	const description = answers && answers.description;
	const templateDir = (answers && answers.directory) || templateDefaultDir;

	try {
		// copy over files for new component
		const component = framework.components.badge[answers.type];
		if (component || !component.path || !component.files?.length) {
			// create component template JSON descriptor file
			await writeTemplateFile(
				path.resolve(context.project.path, templateDir, `${componentName}.json`),
				generateTemplateSettings({ name, description, type: `${TEMPLATE_TYPE_BADGES}/${answers.type}` })
			);

			let options = { clobber: false };
			const variables = { 'snapfu.variables.name': componentName };

			options.transform = async (read, write, file) => {
				await copyTransform(read, write, variables, file);
			};

			// filter out files only in list
			options.filter = (name) => {
				const fileDetails = path.parse(name);
				if (fileDetails.ext) {
					// if file has an extension check if it is in the component file list - list will exclude language (eg. js/ts) based on context
					return component.files.includes(fileDetails.base);
				} else {
					// directory
					return true;
				}
			};

			// rename files
			options.rename = (name) => {
				let filePath;
				const fileDetails = path.parse(name);

				if (fileDetails.ext && fileDetails.name.toLowerCase() == answers.type.toLowerCase()) {
					// rename the file if it is not a directory AND it has a name matching the directory name (eg. default)
					fileDetails.name = componentName;
					delete fileDetails.base; // needed so that path.format utilizes name and ext
					const newName = path.format(fileDetails);

					filePath = newName;
				} else {
					filePath = name;
				}

				// logging for wether we create or not
				fs.stat(filePath, (exists) => {
					if (!exists) {
						console.log(chalk.yellow(`File already exists: ${filePath}`));
					} else {
						console.log(chalk.green(`Creating file: ${filePath}`));
					}
				});

				return filePath;
			};

			const projectComponentDirectory = path.resolve(context.project.path, templateDir);

			await copy(component.path, projectComponentDirectory, options);
		} else {
			throw `Component "${componentName}" in library is corrupt!`;
		}
	} catch (err) {
		console.log(chalk.red(`Error: Failed to initialize template.`));
		console.log(err);
	}
}

export async function listBadgeTemplates(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, location] = options.args;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!location || location == 'local') {
		console.log(`${chalk.whiteBright(`Local Templates`)}`);

		// look for templates, but only in the ./src directory
		const templates = await getTemplates(path.join(context.project.path, 'src'));

		if (!templates || !templates.length) {
			console.log(chalk.italic('        no templates found...'));
		} else {
			console.log(`    ${chalk.white(`Badge Templates`)}`);
			templates.map((template) => {
				console.log(`        ${chalk.green(template.details.name)} (${template.details.label})`);
			});
		}
	}

	if (!location || location == 'remote') {
		if (!location) {
			console.log();
		}
		const list = async (secretKey, siteId = '', name = '') => {
			const remoteTemplates = await new ConfigApi(secretKey, options.dev).getBadgeTemplates();
			await wait(500);
			const remoteLocations = await new ConfigApi(secretKey, options.dev).getBadgeLocations();

			console.log(`${chalk.whiteBright(`Active Remote Templates (SMC) - ${name} ${chalk.cyan(`(${siteId})`)}`)}`);

			if (!remoteTemplates || !remoteTemplates.badgeTemplates || !remoteTemplates.badgeTemplates.length) {
				console.log(chalk.italic('    no templates found...'));
			} else {
				console.log(`    ${chalk.white(`Badge Templates`)}`);

				const maxLengthTag = remoteTemplates.badgeTemplates.reduce((max, template) => {
					return template.tag.length > max ? template.tag.length : max;
				}, 0);
				const maxLengthName = remoteTemplates.badgeTemplates.reduce((max, template) => {
					return template.name.length > max ? template.name.length : max;
				}, 0);

				remoteTemplates.badgeTemplates.map((template) => {
					process.stdout.write(`        ${chalk.green(template.tag.padEnd(maxLengthTag + 2))}`);
					process.stdout.write(`${chalk.gray(template.name.padEnd(maxLengthName + 2))}`);
					process.stdout.write(
						`Created: ${new Date(template.createdDate).toLocaleDateString()} ${new Date(template.createdDate).toLocaleTimeString('en-US')}   Updated: ${new Date(template.updatedDate).toLocaleDateString()} ${new Date(template.updatedDate).toLocaleTimeString('en-US')}\n`
					);
				});
				if (remoteLocations.locations) {
					console.log(`    ${chalk.white(`Badge Locations`)}`);
					process.stdout.write(
						`        ${chalk.green(`locations    ${chalk.gray(`${remoteLocations.global == 1 ? 'global' : LOCATIONS_FILE}`.padEnd(maxLengthName + 2))}`)}`
					);
					process.stdout.write(
						`Created: ${new Date(remoteLocations.createdDate).toLocaleDateString()} ${new Date(remoteLocations.createdDate).toLocaleTimeString('en-US')}   Updated: ${new Date(remoteLocations.updatedDate).toLocaleDateString()} ${new Date(remoteLocations.updatedDate).toLocaleTimeString('en-US')}\n`
					);
				}
			}
		};

		try {
			if (options.multipleSites.length) {
				for (let i = 0; i < options.multipleSites.length; i++) {
					const { secretKey, siteId, name } = options.multipleSites[i];
					await list(secretKey, siteId, name);
					await wait(500);
					if (i < options.multipleSites.length - 1) console.log();
				}
			} else {
				const { secretKey } = options.options;
				await list(secretKey, options.context.searchspring.siteId, options.context.repository.name);
				await wait(500);
			}
		} catch (err) {
			console.log(chalk.red(err));
		}
	}
}

export async function removeBadgeTemplate(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, templateName] = options.args;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	if (!templateName) {
		console.log(chalk.red(`Template name is required.`));
		return;
	}

	const payload = { name: templateName };

	const remove = async (secretKey) => {
		try {
			// using fancy terminal output replacement
			process.stdout.write(`${chalk.green(`        ${templateName}`)} `);

			const { message } = await new ConfigApi(secretKey, options.dev).archiveBadgeTemplate(payload);
			if (message === 'success') {
				process.stdout.write(chalk.gray.italic('- archived in remote'));
			} else {
				process.stdout.write(chalk.red.italic(message));
				console.log();
			}
		} catch (err) {
			process.stdout.write(chalk.red.italic('- archived failed'));
			console.log('        ', chalk.red(err));
		}
	};

	if (options.multipleSites.length) {
		for (let i = 0; i < options.multipleSites.length; i++) {
			const { secretKey, siteId, name } = options.multipleSites[i];

			console.log(`${chalk.white.bold(`${name} ${chalk.cyan(`(${siteId})`)}`)}`);
			await remove(secretKey);
			await wait(500);
		}
	} else {
		const { secretKey } = options.options;
		console.log(`${chalk.white.bold(`${repository.name}`)}`);
		await remove(secretKey);
		await wait(500);
	}
}

function validateLocations(locations) {
	const invalidLocationsParam = [];
	const requiredLocationParams = ['type', 'overlay', 'callout'];
	requiredLocationParams.forEach((requiredParam) => {
		if (!(requiredParam in locations.details)) {
			invalidLocationsParam.push(`locations paramater '${requiredParam}' is required`);
		}
	});
	const overlay = locations.details.overlay;
	const callout = locations.details.callout;
	if (typeof overlay !== 'object' || !Array.isArray(overlay.left) || !Array.isArray(overlay.right) || !overlay.left.length || !overlay.right.length) {
		invalidLocationsParam.push(
			`Error: locations paramater 'overlay' must be an object containing left and right properties of type array with at least 1 location`
		);
	} else if (overlay.left.length > 10 || overlay.right.length > 10) {
		invalidLocationsParam.push(`Error: locations paramater 'overlay' left or right properties must not exceed 10 locations`);
	} else {
		overlay.left.map((location, index) => {
			if (!('name' in location) || typeof location.name !== 'string' || !location.name) {
				invalidLocationsParam.push(`Error: locations paramater 'overlay.left[${index}]' must have a 'name' property`);
			}
			if (!('label' in location) || typeof location.label !== 'string' || !location.label) {
				invalidLocationsParam.push(`Error: locations paramater 'overlay.left[${index}]' must have a 'label' property`);
			}
		});
		overlay.right.map((location, index) => {
			if (!('name' in location) || typeof location.name !== 'string' || !location.name) {
				invalidLocationsParam.push(`Error: locations paramater 'overlay.right[${index}]' must have a 'name' property`);
			}
			if (!('label' in location) || typeof location.label !== 'string' || !location.label) {
				invalidLocationsParam.push(`Error: locations paramater 'overlay.right[${index}]' must have a 'label' property`);
			}
		});
	}
	if (!Array.isArray(callout) || !callout.length) {
		invalidLocationsParam.push(`Error: locations paramater 'callout' must be an array with at least 1 location`);
	} else if (callout.length > 10) {
		invalidLocationsParam.push(`Error: locations paramater 'callout' must not exceed 10 locations`);
	} else {
		callout.map((location, index) => {
			if (!('name' in location) || typeof location.name !== 'string' || !location.name) {
				invalidLocationsParam.push(`Error: locations paramater 'callout[${index}]' must have a 'name' property`);
			}
			if (!('label' in location) || typeof location.label !== 'string' || !location.label) {
				invalidLocationsParam.push(`Error: locations paramater 'callout[${index}]' must have a 'label' property`);
			}
		});
	}

	const allLocations = [...overlay.left, ...overlay.right, ...callout].map((location) => location.name);
	const duplicateLocations = allLocations.filter((location, index) => allLocations.indexOf(location) !== index);
	if (duplicateLocations.length) {
		invalidLocationsParam.push(`Error: locations paramater has duplicate location names: ${duplicateLocations.join(', ')}`);
	}

	if (invalidLocationsParam.length) {
		console.log(chalk.gray(locations.path));
		console.log(chalk.red(`Error: at ${LOCATIONS_FILE} file with the following issues:`));
		invalidLocationsParam.forEach((param) => {
			console.log('\t - ' + chalk.cyanBright(`${param}`));
		});
		exit(1);
	}
}

function validateTemplate(template, locations) {
	const requiredParams = ['type', 'name', 'label', 'component', 'locations'];
	let invalidParam = [];
	requiredParams.forEach((requiredParam) => {
		if (!(requiredParam in template.details)) {
			invalidParam.push(`template paramater '${requiredParam}' is required`);
		}
	});
	if (invalidParam.length) {
		// log missing template parameters first
		console.log(chalk.gray(template.path));
		console.log(chalk.red(`Error: at Template ${template.details?.name ? `'${template.details?.name}' ` : ''}has the following issues:`));
		invalidParam.forEach((param) => {
			console.log('\t - ' + chalk.cyanBright(`${param}`));
		});
		exit(1);
	}

	Object.keys(template.details).forEach((detail) => {
		// validate each parameter
		switch (detail) {
			case 'type':
				// handled by getTemplates - would not reach here.
				// case statement still required to be here for default statement handling unknown parameters
				break;
			case 'name':
				if (typeof template.details[detail] !== 'string' || !template.details[detail].match(/^[a-zA-Z0-9_-]*$/) || !template.details[detail]) {
					invalidParam.push(`template paramater '${detail}' must be an alphanumeric string (underscore and dashes also supported)`);
				}
				break;
			case 'label':
			case 'description':
			case 'component':
				if (typeof template.details[detail] !== 'string') {
					invalidParam.push(`template paramater '${detail}' must be a string`);
				}
				break;
			case 'locations':
				if (!Array.isArray(template.details[detail])) {
					invalidParam.push(`template paramater '${detail}' must be an array`);
				} else {
					if (template.details[detail].length == 0) {
						invalidParam.push(`template paramater '${detail}' must have at least 1 location`);
					}
					if (template.details[detail].length > 20) {
						invalidParam.push(`template paramater '${detail}' must not exceed 20 locations`);
					}
					if (locations?.details) {
						template.details[detail].map((location, index) => {
							if (typeof location !== 'string') {
								invalidParam.push(`template paramater '${detail}' must be an array of strings. Location ${index + 1} is not a string`);
							} else if (
								(!location.startsWith('callout') &&
									!location.startsWith('overlay') &&
									!location.startsWith('overlay/left') &&
									!location.startsWith('overlay/right')) ||
								location == 'overlay/left/' ||
								location == 'overlay/right/'
							) {
								invalidParam.push(
									`template paramater '${detail}' must be 'overlay', 'callout', 'callout/[name]', 'overlay/left', 'overlay/right', 'overlay/left/[name]' or 'overlay/right/[name]'`
								);
							}

							const [L1, L2, L3] = location.split('/');
							if (L1) {
								// overlay / callout
								if (L1 === 'overlay') {
									// left / right
									if (L2 === 'left' || L2 === 'right' || !L2) {
										// allow left/right/undefined
										// name of overlay
										if (L3) {
											const match = locations.details.overlay[L2].find((overlay) => overlay.name === L3);
											if (!match) {
												invalidParam.push(
													`template paramater '${detail}' at index ${index} does not match any overlay location in ${LOCATIONS_FILE}`
												);
											}
										}
									} else {
										invalidParam.push(
											`template paramater '${detail}' at index ${index} must start with 'overlay', 'overlay/left' or 'overlay/right'`
										);
									}
								} else if (L1 === 'callout') {
									// name of callout
									if (L2) {
										const match = locations.details.callout.find((callout) => callout.name === L2);
										if (!match) {
											invalidParam.push(`template paramater '${detail}' at index ${index} does not match any callout location in ${LOCATIONS_FILE}`);
										}
									}
								} else {
									invalidParam.push(`template paramater '${detail}' at index ${index} must start with 'overlay' or 'callout'`);
								}
							} else {
								invalidParam.push(`template paramater '${detail}' at index ${index} must be a string with a value`);
							}
						});
					}
				}
				break;
			case 'value':
				if (
					typeof template.details[detail] !== 'object' ||
					!('enabled' in template.details[detail]) ||
					typeof template.details[detail]['enabled'] !== 'boolean'
				) {
					invalidParam.push(`template paramater '${detail}' must be an object with boolean property 'enabled'`);
				}
				if ('validations' in template.details[detail] && typeof template.details[detail]['validations'] !== 'object') {
					invalidParam.push(`template paramater '${detail}.validations' must be an object with properties min, max, regex and regexExplain`);
				}
				if ('validations' in template.details[detail]) {
					if (
						'min' in template.details[detail]['validations'] &&
						(typeof template.details[detail]['validations']['min'] !== 'number' || template.details[detail]['validations']['min'] < 0)
					) {
						invalidParam.push(`template paramater '${detail}.validations.min' must not be a number below 0`);
					}
					if (
						'max' in template.details[detail]['validations'] &&
						(typeof template.details[detail]['validations']['max'] !== 'number' || template.details[detail]['validations']['max'] < 0)
					) {
						invalidParam.push(`template paramater '${detail}.validations.max' must not be a number below 0`);
					}
					if (
						'min' in template.details[detail]['validations'] &&
						'max' in template.details[detail]['validations'] &&
						template.details[detail]['validations']['min'] > template.details[detail]['validations']['max']
					) {
						invalidParam.push(`template paramater '${detail}.validations.min' must be a number lower than '${detail}.validations.max'`);
					}
					if (
						'regex' in template.details[detail]['validations'] &&
						(typeof template.details[detail]['validations']['regex'] !== 'string' || !template.details[detail]['validations']['regex'])
					) {
						invalidParam.push(`template paramater '${detail}.validations.regex' must be a string`);
					}
					if ('regex' in template.details[detail]['validations'] && !('regexExplain' in template.details[detail]['validations'])) {
						invalidParam.push(`template paramater '${detail}.validations' When using regex, please also provide regexExplain`);
					}
					if (
						'regexExplain' in template.details[detail]['validations'] &&
						(typeof template.details[detail]['validations']['regexExplain'] !== 'string' || !template.details[detail]['validations']['regexExplain'])
					) {
						invalidParam.push(`template paramater '${detail}.validations.regexExplain' must be a string`);
					}
				}
				break;
			case 'parameters':
				if (!Array.isArray(template.details[detail])) {
					invalidParam.push(`template paramater '${detail}' must be an array`);
				} else {
					template.details[detail].map((parameter, i) => {
						Object.keys(parameter).forEach((key) => {
							if (!['name', 'type', 'label', 'description', 'defaultValue', 'validations', 'options'].includes(key)) {
								invalidParam.push(`template paramater '${detail}[${i}].${key}' is not a valid parameter`);
							}
							if (['name', 'type', 'label', 'description', 'defaultValue'].includes(key) && (typeof parameter[key] !== 'string' || !parameter[key])) {
								invalidParam.push(`template paramater '${detail}[${i}].${key}' must be a string with a value`);
							}
							const allowedTypes = ['array', 'string', 'color', 'url', 'integer', 'decimal', 'boolean', 'checkbox', 'toggle'];
							if (key === 'type' && !allowedTypes.includes(parameter[key])) {
								invalidParam.push(`template paramater '${detail}[${i}].${key}' must be one of allowed types: ${allowedTypes.join(', ')}`);
							}
							if (key === 'type' && parameter[key] === 'array') {
								if (
									!('options' in template.details[detail][i]) ||
									!Array.isArray(template.details[detail][i]['options']) ||
									template.details[detail][i]['options'].length === 0
								) {
									invalidParam.push(
										`template paramater '${detail}[${i}].options' must be an array with at least 1 option when type: 'array' is used`
									);
								}
							}
							if (key === 'validations') {
								if (typeof parameter[key] !== 'object') {
									invalidParam.push(`template paramater '${detail}[${i}].${key}' must be an object`);
								}
								if ('min' in parameter[key] && (typeof parameter[key]['min'] !== 'number' || parameter[key]['min'] < 0)) {
									invalidParam.push(`template paramater '${detail}[${i}].${key}.min' must not be a number below 0`);
								}
								if ('max' in parameter[key] && (typeof parameter[key]['max'] !== 'number' || parameter[key]['max'] < 0)) {
									invalidParam.push(`template paramater '${detail}[${i}].${key}.max' must not be a number below 0`);
								}
								if ('min' in parameter[key] && 'max' in parameter[key] && parameter[key]['min'] > parameter[key]['max']) {
									invalidParam.push(`template paramater '${detail}[${i}].${key}.min' must be a number lower than '${detail}[${i}].${key}.max'`);
								}
								if ('regex' in parameter[key] && (typeof parameter[key]['regex'] !== 'string' || !parameter[key]['regex'])) {
									invalidParam.push(`template paramater '${detail}[${i}].${key}.regex' must be a string`);
								}
								if ('regex' in parameter[key] && !('regexExplain' in parameter[key])) {
									invalidParam.push(`template paramater '${detail}[${i}].${key}' When using regex, please also provide regexExplain`);
								}
								if ('regexExplain' in parameter[key] && (typeof parameter[key]['regexExplain'] !== 'string' || !parameter[key]['regexExplain'])) {
									invalidParam.push(`template paramater '${detail}[${i}].${key}.regexExplain' must be a string`);
								}
							}
						});
					});
				}
				break;
			default:
				invalidParam.push(`unknown template parameter '${detail}' should be removed`);
				break;
		}
	});
	if (invalidParam.length) {
		console.log(chalk.gray(template.path));
		console.log(chalk.red(`Error: at Template ${template.details?.name ? `'${template.details?.name}' ` : ''}has the following issues:`));
		invalidParam.forEach((param) => {
			console.log('\t - ' + chalk.cyanBright(`${param}`));
		});
		exit(1);
	}
}

export async function syncBadgeTemplate(options) {
	const { context } = options;
	const { searchspring, repository } = context;
	const [command, templateName] = options.args;
	const { secretKey } = options.options;

	if (!searchspring || !context.project || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	const locations = await getLocationsFile(context.project.path);
	if (locations) {
		validateLocations(locations);
	}

	const templates = await getTemplates(context.project.path);
	const syncTemplates = templates.filter((template) => {
		validateTemplate(template, locations);
		if (templateName) {
			if (template.details.name == templateName) {
				return template;
			}
		} else {
			return template;
		}
	});

	if (!syncTemplates.length && templateName != LOCATIONS_FILE) {
		console.log(chalk.red(`Error: Template(s) not found.`));
		return;
	}

	const sync = async (template, secretKey) => {
		const payload = buildBadgeTemplatePayload(template.details);
		const remoteTemplates = await new ConfigApi(secretKey, options.dev).getBadgeTemplates();
		const remoteTemplate = remoteTemplates.badgeTemplates?.find((remoteTemplate) => remoteTemplate.tag == template.details.name);
		let skipTemplateUpdate = false;
		if (remoteTemplate) {
			try {
				// check if remote template already matches local template
				const { name, description, snapComponent, labelConfig, locations } = remoteTemplate;
				// object property order stored in db may differ than what's synced, map to match payload order for comparison below
				const properties = JSON.parse(remoteTemplate.properties).map((remoteParameter) => {
					return {
						name: remoteParameter.name,
						type: remoteParameter.type,
						label: remoteParameter.label,
						description: remoteParameter.description,
						defaultValue: remoteParameter.defaultValue,
						validations: remoteParameter.validations,
						options: remoteParameter.options,
					};
				});
				const templateMatchRemote =
					payload.label === name &&
					payload.description === description &&
					payload.component === snapComponent &&
					JSON.stringify(payload.value) === JSON.stringify(JSON.parse(labelConfig)) &&
					JSON.stringify(payload.locations.sort()) === JSON.stringify(JSON.parse(locations).sort()) &&
					JSON.stringify(payload.parameters) === JSON.stringify(properties);

				if (templateMatchRemote) {
					console.log(chalk.green(`        ${template.details.name} - ${chalk.yellow(`no changes to sync`)}`));
					skipTemplateUpdate = true;
				}
			} catch (e) {
				console.log(chalk.red(`Error: Failed parse JSON from remote template ${remoteTemplate.tag}`));
				console.log(e);
				exit(1);
			}
		}
		if (!skipTemplateUpdate) {
			try {
				await wait(500);
				const { message } = await new ConfigApi(secretKey, options.dev).putBadgeTemplate(payload);
				if (message === 'success') {
					console.log(chalk.green(`        ${template.details.name} - ${chalk.gray.italic('synced to remote')}`));
				} else {
					process.stdout.write(chalk.red.italic(message));
					console.log();
				}
			} catch (err) {
				console.log(chalk.red(`        ${template.details.name}`));
				console.log('        ', chalk.red(err));
				exit(1);
			}
		}
	};

	const syncLocations = async (secretKey) => {
		console.log(`    synchronizing locations`);
		const locationsPayload = buildBadgeLocationsPayload(locations.details);
		const remoteBadgeLocations = await new ConfigApi(secretKey, options.dev).getBadgeLocations();
		let skipLocationsUpdate = false;
		// Sync custom locations if locations.json file exists
		if (remoteBadgeLocations.locations) {
			try {
				// check if remote locations already matches local locations
				const localOverlay = locationsPayload.overlay;
				const localCallout = locationsPayload.callout;
				const remoteLocations = JSON.parse(remoteBadgeLocations.locations);
				const remoteOverlay = remoteLocations.overlay;
				const remoteCallout = remoteLocations.callout;

				const locationsMatchRemote =
					JSON.stringify(localOverlay) === JSON.stringify(remoteOverlay) && JSON.stringify(localCallout) === JSON.stringify(remoteCallout);
				if (locationsMatchRemote) {
					console.log(
						chalk.green(
							`        ${LOCATIONS_FILE} - ${chalk.yellow(`remote custom locations matches local locations payload. This template will not be synced`)}`
						)
					);
					skipLocationsUpdate = true;
				}
			} catch (e) {
				console.log(chalk.red(`Error: Failed parse JSON from remote locations`));
				console.log(e);
				exit(1);
			}
		}
		if (!skipLocationsUpdate) {
			try {
				await wait(500);
				const { message } = await new ConfigApi(secretKey, options.dev).putBadgeLocations(locationsPayload);
				if (message === 'success') {
					console.log(chalk.green(`        ${LOCATIONS_FILE} - ${chalk.gray.italic('synced to remote')}`));
				} else {
					process.stdout.write(chalk.red.italic(message));
					console.log();
				}
			} catch (err) {
				console.log(chalk.red(`        ${LOCATIONS_FILE}`));
				console.log('        ', chalk.red(err));
				exit(1);
			}
		}
	};

	if (options.multipleSites.length) {
		for (let x = 0; x < options.multipleSites.length; x++) {
			const { secretKey, siteId, name } = options.multipleSites[x];

			console.log(`${chalk.white.bold(`${name} ${chalk.cyan(`(${siteId})`)}`)}`);
			for (let i = 0; i < syncTemplates.length; i++) {
				const template = syncTemplates[i];
				console.log(`    synchronizing template ${i + 1} of ${syncTemplates.length}`);

				await sync(template, secretKey);
				await wait(500);
			}
			if ((locations && syncTemplates.length && !templateName) || templateName == LOCATIONS_FILE) {
				await syncLocations(secretKey);
				await wait(500);
			}

			if (x < options.multipleSites.length - 1) console.log();
		}
	} else {
		console.log(`${chalk.white.bold(`${repository.name}`)}`);
		for (let i = 0; i < syncTemplates.length; i++) {
			const template = syncTemplates[i];
			console.log(`    synchronizing template ${i + 1} of ${syncTemplates.length}`);
			await sync(template, secretKey);
			await wait(500);
			if ((locations && syncTemplates.length && !templateName) || templateName == LOCATIONS_FILE) {
				await syncLocations(secretKey);
				await wait(500);
			}
		}
	}
}

export function generateTemplateSettings({ name, description, type }) {
	let settings = {
		type,
		name: handleize(name),
		label: `${pascalCase(name)} Badge`,
		description: description || `${name} custom template`,
		component: `${pascalCase(name)}`,
		locations: ['overlay', 'callout'],
		value: {
			enabled: true,
		},
		parameters: [],
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
					template.details.type &&
					template.details.type.startsWith(TEMPLATE_TYPE_BADGES) &&
					template.details.type !== `${TEMPLATE_TYPE_BADGES}/locations`
				) {
					return template;
				}
			});
	} catch (err) {
		console.log(err);
		return [];
	}
}

export async function getLocationsFile(dir) {
	try {
		const files = await findJsonFiles(dir);
		const fileReads = files.map((filePath) => readTemplateSettings(filePath));
		const fileContents = await Promise.all(fileReads);

		const locations = fileContents
			.map((template, index) => {
				return {
					path: files[index],
					details: template,
				};
			})
			.filter((template) => {
				if (typeof template.details == 'object' && template.details.type === `${TEMPLATE_TYPE_BADGES}/locations`) {
					return template;
				}
			});
		if (locations.length > 1) {
			console.log(chalk.red(`Error: Multiple locations files found in ${dir}`));
			exit(1);
		}
		return locations[0];
	} catch (err) {
		console.log(err);
		return;
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
	// get all JSON files (exclude looking in excluded directories)
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

					if (!fileStats.isSymbolicLink() && fileStats.isDirectory() && !DIR_EXCLUDE_LIST.includes(file)) {
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

export function buildBadgeLocationsPayload(template) {
	return {
		type: template.type,
		overlay: template.overlay,
		callout: template.callout,
	};
}
export function buildBadgeTemplatePayload(template) {
	return {
		type: template.type,
		name: template.name,
		label: template.label || `${pascalCase(template.name)} Badge`,
		description: template.description || `${template.name} custom template`,
		component: template.component,
		locations: template.locations,
		value: {
			enabled: typeof template.value.enabled === 'boolean' ? template.value.enabled : true,
			validations: template.value.validations || null,
		},
		parameters:
			template.parameters?.map((parameter) => {
				// mapping to only include the necessary fields
				return {
					name: parameter.name,
					type: parameter.type,
					label: parameter.label,
					description: parameter.description,
					defaultValue: parameter.defaultValue,
					validations: parameter.validations,
					options: parameter.options,
				};
			}) || [],
	};
}
