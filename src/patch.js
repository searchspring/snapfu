import { existsSync, mkdirSync, promises as fsp, statSync } from 'fs';
import path from 'path';
import { exit } from 'process';
import chalk from 'chalk';
import ncp from 'ncp';
import YAML from 'yaml';

import { auth } from './login.js';
import { cmp, commandOutput } from './utils/index.js';

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
			console.log(stdout || stderr);
		} else {
			console.log(`Cloning ${options.config.patches.repoName} into ${options.config.patches.dir} via SSH...`);
			const { stdout, stderr } = await commandOutput(
				`git clone ${options.config.patches.repoUrl} ${options.config.patches.repoName}`,
				options.config.searchspringDir
			);
			console.log(stdout || stderr);
		}
	} catch (e) {
		console.log(chalk.red(`Failed to update patch files!`));
		console.log(chalk.red(e));
		exit(1);
	}
};

export const listPatches = async (options) => {
	await setupPatchRepo(options);

	const { context } = options;
	const { projectVersion } = context;

	if (!projectVersion) {
		console.log(chalk.red(`Could not find project version in package.json`));
		exit(1);
	}

	const availablePatches = await getVersions(options, projectVersion);

	console.log(chalk.white.bold(`Current Project Version:`), chalk.bold.cyan(projectVersion));

	if (availablePatches.length) {
		console.log(chalk.white.bold('Available Patches:'));
	}
	availablePatches.forEach((version) => {
		console.log(chalk.white(version));
	});
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
		versions = versions.filter((version) => cmp(version, startingAt) === 1);
	}

	if (endingAt) {
		versions = versions.filter((version) => cmp(version, endingAt) <= 0);
	}

	return versions;
};

export const applyPatches = async (options) => {
	await setupPatchRepo(options);

	const { context } = options;
	const { projectVersion } = context;
	const [_command, versionApply] = options.args;

	// verify project version
	if (!projectVersion.match(/^\d+\.\d+\.\d+\w?$/)) {
		console.log('Project version invalid.');
		return;
	}

	const availablePatches = await getVersions(options);

	// verify requested version
	const versionMatch = /^\w?(\d+\.\d+\.\d+\w?)$/.exec(versionApply);
	let filteredVersionApply;

	if (versionApply == 'latest') {
		filteredVersionApply = undefined;
	} else if (versionApply && versionMatch && versionMatch.length == 2) {
		filteredVersionApply = versionMatch[1];

		// check if versionApply is included in available patches
		if (!availablePatches.includes(filteredVersionApply)) {
			console.log(`Patch version ${filteredVersionApply} does not exist.`);
			return;
		}
	} else {
		console.log('Patch version invalid.');
		return;
	}

	let patches;
	try {
		patches = await getVersions(options, projectVersion, filteredVersionApply);
		if (patches.length == 0) {
			console.log('Nothing to patch.');
			return;
		}
	} catch (err) {
		console.log('Patch version not found.');
		return;
	}

	// apply patches one at a time
	for (const patch of patches) {
		console.log(`Applying patch for v${patch}...`);
		await applyPatch(options, patch);
	}
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
		// delete existing directory
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

	// TODO: if run with --commit flag, (as would be done in the snap-action) a commit should be made
};

const runPatch = async (options, patchFile) => {
	// ingest YAML
	let patchContents;
	try {
		const yamlFile = await fsp.readFile(patchFile, 'utf8');
		patchContents = YAML.parse(yamlFile);
	} catch (err) {
		console.log(`Could not parse patch file ${patchFile}`);
		exit(1);
	}

	console.log(`\n\n${path.basename(patchFile)} contents`, patchContents);

	const { steps } = patchContents;

	// steps supported (file, run);
	for (const step of steps) {
		const actions = Object.keys(step);

		for (const action of actions) {
			switch (action) {
				case 'run':
					const run = step[action];
					try {
						const commands = run.split('\n');
						for (const cmd of commands) {
							console.log(cmd);
							const { stdout, stderr } = await commandOutput(cmd);
							if (stdout) {
								console.log('\n' + stdout);
							}
							if (stderr) {
								console.log('\n' + stderr);
							}
						}
					} catch (e) {
						console.log('Run command encountered an error:', e);
						exit(1);
					}
					break;
				case 'files':
					const files = step[action];
					console.log('files', files);
					const fileNames = Object.keys(files);
					for (const fileName of fileNames) {
						const { action, changes } = files[fileName];
						switch (action) {
							case 'edit':
								try {
									const extension = fileName.split('.').pop();
									if (['json', 'yaml', 'yml'].includes(extension)) {
										await editYAMLorJSON(options, fileName, changes, extension);
									} else {
										// other file in implementation to edit
										// TODO: support editing other file types
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

export const editYAMLorJSON = async (options, fileName, changes, fileType) => {
	if (!changes.length) {
		return;
	}

	const parser = fileType === 'json' ? JSON : YAML;
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
								const initialReference = file[keyToRemove];
								let currentPath = initialReference;

								for (let i = 0; i < pathToRemove.length; i++) {
									currentPath = currentPath[pathToRemove[i]];
								}

								// loop through the obj and delete keys
								obj.forEach((key) => {
									delete currentPath[key];
								});
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
	if (parser.stringify(originalFile) === parser.stringify(file)) {
		console.log(`No changes have been made to ${fileName}`);
	} else {
		console.log(`writing changes: ${fileName}`);
		await fsp.writeFile(filePath, parser.stringify(file, null, '\t'), 'utf8');
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
