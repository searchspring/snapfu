import { existsSync, mkdirSync, promises as fsp, statSync } from 'fs';
import path from 'path';
import { exit } from 'process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ncp from 'ncp';
import YAML from 'yaml';

import { cmp, commandOutput, boxify, boxifyVersions } from './utils/index.js';

export const setupPatchRepo = async (options) => {
	const { context } = options;
	const { searchspring, projectVersion } = context;
	const { framework } = searchspring || {};

	if (!searchspring || !context.project || !context.project.path || !framework || !projectVersion) {
		console.log(chalk.red(`Error: No Snap project found.`));
		exit(1);
	}

	// clone or pull snapfu patches repository
	try {
		if (!existsSync(options.config.searchspringDir)) {
			mkdirSync(options.config.searchspringDir);
		}
		if (existsSync(options.config.patches.dir)) {
			console.log(`Updating ${options.config.patches.repoName}...`);
			const { stdout, stderr } = await commandOutput(`git pull`, options.config.patches.dir);
			// console.log(stdout || stderr);
		} else {
			console.log(`Cloning ${options.config.patches.repoName} into ${options.config.patches.dir} ...`);
			const { stdout, stderr } = await commandOutput(
				`git clone ${options.config.patches.repoUrl} ${options.config.patches.repoName}`,
				options.config.searchspringDir
			);
			// console.log(stdout || stderr);
		}
	} catch (e) {
		console.log(chalk.red(`Failed to update patch files!`));
		// console.log(chalk.red(e));
		exit(1);
	}
};

export const listPatches = async (options, skipUpdate = false) => {
	if (!skipUpdate) await setupPatchRepo(options);

	const { context } = options;
	const { projectVersion } = context;
	let startVersion = projectVersion;

	if (!projectVersion) {
		console.log(chalk.red(`Could not find project version in package.json`));
		exit(1);
	}

	if (options.args[1] == 'all') {
		startVersion = undefined;
	}

	const availablePatches = await getVersions(options, startVersion);

	console.log(`\n${chalk.white.bold(`Current Project Version:`)} ${chalk.bold.cyan(projectVersion)}`);

	if (availablePatches.length) {
		console.log(chalk.white.bold(`\n${startVersion ? 'Available ' : ''}Patches:`));
		availablePatches.forEach((version) => {
			if (version == projectVersion) {
				console.log(chalk.cyan(`${chalk.bold(version)} (current)`));
			} else {
				console.log(`${version}`);
			}
		});
	} else {
		console.log(chalk.cyan('Project is on latest version.'));
	}
};

export const getVersions = async (options, startingAt, endingAt) => {
	const { context } = options;
	const { searchspring } = context;
	const { framework } = searchspring || {};

	// ~/.searchspring/snapfu-patches/{framework}/{version}
	const frameworkPath = path.join(options.config.patches.dir, framework);
	const patchVersions = await fsp.readdir(path.join(frameworkPath));
	let versions = [];
	for (const file of patchVersions) {
		const filePath = path.resolve(frameworkPath, file);
		const fileStats = await statSync(filePath);
		if (fileStats.isDirectory()) {
			versions.push(file);
		}
	}
	versions.sort(cmp);

	if (startingAt) {
		versions = versions.filter((version) => cmp(version, startingAt) > 0);
	}

	if (endingAt) {
		versions = versions.filter((version) => cmp(version, endingAt) <= 0);
	}

	return versions;
};

export const applyPatches = async (options, skipUpdate = false) => {
	if (!skipUpdate) await setupPatchRepo(options);

	const { context } = options;
	const { projectVersion } = context;
	const [_command, versionApply] = options.args;

	// verify project version
	if (!projectVersion.match(/^\w?(\d+\.\d+\.\d+-?\d*)$/)) {
		console.log('Project version invalid.');
		exit(1);
	}

	const availablePatches = await getVersions(options);

	// verify requested version
	const versionMatch = /^\w?(\d+\.\d+\.\d+-?\d*)$/.exec(versionApply);
	let filteredVersionApply;

	if (versionApply == 'latest') {
		filteredVersionApply = undefined;
	} else if (versionApply && versionMatch && versionMatch.length == 2) {
		filteredVersionApply = versionMatch[1];

		// check if versionApply is included in available patches
		if (!availablePatches.includes(filteredVersionApply)) {
			console.log(`Patch version ${filteredVersionApply} does not exist.`);
			exit(1);
		}
	} else if (!versionApply) {
		console.log(chalk.yellow(`\nPatch version not provided.`));
		await listPatches(options, true);
		exit(1);
	} else {
		console.log(chalk.red('Patch version invalid.'));
		exit(1);
	}

	let patches;
	try {
		patches = await getVersions(options, projectVersion, filteredVersionApply);
		if (patches.length == 0) {
			console.log(`\n${chalk.bold('Nothing to patch.')}`);
			if (!filteredVersionApply) console.log(chalk.cyan('Project is on latest version.'));
			exit();
		}
	} catch (err) {
		console.log('Patch version not found.');
		exit(1);
	}

	// display transition output
	const finalVersion = patches[patches.length - 1];
	console.log(`\n${chalk.cyan.bold('Apply Patch')}`);
	console.log(chalk.cyan(boxifyVersions(` ${projectVersion} `, ` ${finalVersion} `)));

	if (!options?.options?.ci) {
		const question = [
			{
				type: 'confirm',
				name: 'continue',
				message: 'Do you want to continue?',
				default: true,
			},
		];

		const answer = await inquirer.prompt(question);
		if (!answer.continue) {
			exit(0);
		}
	}

	// apply patches one at a time
	for (const patch of patches) {
		console.log(chalk.cyan.bold(`\n${patch}`));
		await applyPatch(options, patch);
	}

	// modify package.json with finalVersion number
	console.log(chalk.blue(`finalizing patch...`));
	await editYAMLorJSON(options, 'package.json', [{ update: { searchspring: { version: finalVersion } } }]);

	// patching complete
	console.log();
	console.log(chalk.cyan(boxify(` ${'patching complete'} `, `site updated to ${finalVersion}`)));
};

export const applyPatch = async (options, patch) => {
	const { context } = options;
	const { searchspring } = context;
	const { framework } = searchspring || {};

	// copy over patch files into ./patch of the project directory

	const projectDir = options.context.project.path;
	const projectPatchDir = path.join(projectDir, 'patch');

	try {
		const exists = await fsp.stat(projectPatchDir);
		// delete existing patch directory
		await fsp.rm(projectPatchDir, { recursive: true, force: true });
	} catch (err) {
		// directory doesn't exist - do nothing
	}

	// copy patch files into ./patch directory in project
	await fsp.mkdir(projectPatchDir);
	const patchDir = path.join(options.config.patches.dir, framework, patch);
	await copyDir(patchDir, projectPatchDir);

	// read the dir and log contents
	const dirFiles = await fsp.readdir(projectPatchDir);

	// execute .yaml files (maintenance first if found, followed by patch)
	dirFiles.sort();
	for (const file of dirFiles) {
		const filePath = path.resolve(projectPatchDir, file);

		if (filePath.includes(`patch/patch.${framework}`) || filePath.includes(`patch/maintenance.${framework}`)) {
			// run patch file
			await runPatch(options, filePath);
		}
	}

	// clean up (remove ./patch)
	await fsp.rm(projectPatchDir, { recursive: true, force: true });
};

const runPatch = async (options, patchFile) => {
	// ingest YAML
	let patchContents;
	try {
		const yamlFile = await fsp.readFile(patchFile, 'utf8');
		patchContents = YAML.parse(yamlFile);
	} catch (err) {
		console.log(`could not parse patch file ${patchFile}`);
		exit(1);
	}

	console.log(chalk.blue(`${path.basename(patchFile)}...`));

	const { steps } = patchContents;

	// steps supported (file, run);
	for (const step of steps) {
		const actions = Object.keys(step);

		for (const action of actions) {
			switch (action) {
				case 'run':
					const run = step[action];
					try {
						const commands = run.trim().split('\n');
						for (const cmd of commands) {
							console.log(chalk.italic(cmd));
							const { stdout, stderr } = await commandOutput(cmd);
							if (stdout) {
								console.log(stdout);
							}
							if (stderr) {
								console.log(stderr);
							}
						}
					} catch (e) {
						console.log('Run command encountered an error:', e);
						exit(1);
					}
					break;
				case 'files':
					const files = step[action];
					const fileNames = Object.keys(files);

					for (const fileName of fileNames) {
						const { action, changes } = files[fileName];
						switch (action) {
							case 'edit':
								try {
									const extension = fileName.split('.').pop();
									if (['json', 'yaml', 'yml'].includes(extension)) {
										await editYAMLorJSON(options, fileName, changes);
									} else {
										// FUTURE TODO: support editing other file types
										// await editFile(options, fileName, changes);
									}
								} catch (err) {
									console.log(err);
									exit(1);
								}

								break;
							default:
								break;
						}
					}
					break;

				default:
					break;
			}
		}
	}
};

export const editYAMLorJSON = async (options, fileName, changes) => {
	if (!changes.length || !fileName) {
		return;
	}

	const fileType = fileName.split('.').pop()?.toLowerCase();
	const parser = fileType == 'json' ? JSON : YAML;
	const projectDir = options.context.project.path;
	const filePath = path.join(projectDir, fileName);

	let contents;
	try {
		await fsp.stat(filePath);
		contents = await fsp.readFile(filePath, 'utf8');
		// file exists
	} catch (err) {
		// directory doesn't exist - do nothing
		console.log(`File ${fileName} does not exist. Skipping`);
		return;
	}

	let file, originalFile;
	try {
		file = parser.parse(contents);
		originalFile = parser.parse(contents);
	} catch (err) {
		throw `editYAMLorJSON unable to parse ${fileName}`;
	}

	// read changes and apply them to parsed JSON
	for (const change of changes) {
		const action = Object.keys(change)[0];
		const keysToChange = Object.keys(change[action]);

		switch (action) {
			case 'update':
				for (const keyToUpdate of keysToChange) {
					const value = change[action][keyToUpdate];

					const checkForNestedObj = (obj, value) => {
						if (typeof value == 'object') {
							const valueObjectKeys = Object.keys(value || {});
							valueObjectKeys.forEach((key) => {
								if (!obj) {
									//obj doesnt exist
									obj = {};
									obj[key] = value[key];
								} else if (Array.isArray(obj[key])) {
									obj[key] = obj[key].concat(value[key]);
								} else if (typeof obj[key] == 'object') {
									//obj is object, run it again
									obj[key] = checkForNestedObj(obj[key], value[key]);
								} else {
									obj[key] = value[key];
								}
							});
						} else if (typeof value == 'string') {
							obj = value;
						}
						return obj;
					};

					//init
					file[keyToUpdate] = checkForNestedObj(file[keyToUpdate], value);
				}
				break;
			case 'remove':
				if (Array.isArray(change[action])) {
					// remove is an array of keys to delete at the top level of file
					change[action].forEach((key) => {
						delete file[key];
					});
				} else if (typeof change[action] === 'object') {
					// remove is an object with possible nested properties to delete
					for (const keyToRemove of keysToChange) {
						if (!(keyToRemove in file)) {
							// keyToRemove is not in file
							return;
						}

						let pathToRemove = [];

						const checkfor = (obj) => {
							if (Array.isArray(obj)) {
								// found leaf node (array)
								let initialReference = file[keyToRemove];
								let currentPath = initialReference;

								for (let i = 0; i < pathToRemove.length; i++) {
									currentPath = currentPath[pathToRemove[i]];
								}

								if (Array.isArray(currentPath)) {
									obj.forEach((value) => {
										const index = currentPath.indexOf(value);
										if (index > -1) {
											currentPath.splice(index, 1);
										}
									});
								} else {
									// loop through the obj and delete keys
									obj.forEach((key) => {
										delete currentPath[key];
									});
								}
							} else {
								// is an object, continue until you find an array
								const keys = Object.keys(obj || {});
								for (let i = 0; i < keys.length; i++) {
									pathToRemove.push(keys[i]);
									checkfor(obj[keys[i]]);
								}
							}
						};
						checkfor(change[action][keyToRemove]);
					}
				}

				break;
			default:
				break;
		}
	}

	// write changes to file
	if (parser.stringify(originalFile) !== parser.stringify(file)) {
		console.log(chalk.italic(`modified ${filePath}`));

		let fileContents;
		if (fileType == 'json') {
			fileContents = parser.stringify(file, null, '\t');
		} else if (fileType == 'yaml' || 'yml') {
			fileContents = parser.stringify(file, { lineWidth: 0 });
		}

		await fsp.writeFile(filePath, fileContents, 'utf8');
	}
};

const copyDir = (source, destination) => {
	return new Promise((resolve, reject) => {
		const options = { clobber: true };
		ncp(source, destination, options, function (err) {
			if (err) {
				reject(err);
			}
			resolve();
		});
	});
};
