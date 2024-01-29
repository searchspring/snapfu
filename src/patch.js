import { existsSync, mkdirSync, promises as fsp, statSync } from 'fs';
import path from 'path';
import { exit } from 'process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import YAML from 'yaml';
import glob from 'glob';

import { editJSON } from './patch/edit-json.js';
import { editYAML } from './patch/edit-yaml.js';
import { cmp, copy, commandOutput, boxify, boxifyVersions } from './utils/index.js';

export const setupPatchRepo = async (options) => {
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
	const { searchspring, projectVersion } = context;
	const { framework } = searchspring || {};
	let startVersion = projectVersion;

	if (!searchspring || !context.project || !context.project.path || !framework || !projectVersion) {
		console.log(chalk.red(`Error: No Snap project found.`));
		exit(1);
	}

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
	const patchDirExists = existsSync(frameworkPath);
	let versions = [];

	if (patchDirExists) {
		const patchVersions = await fsp.readdir(path.join(frameworkPath));
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
	}

	return versions;
};

export const applyPatches = async (options, skipUpdate = false) => {
	if (!skipUpdate) await setupPatchRepo(options);

	const { context } = options;
	const { searchspring, projectVersion } = context;
	const { framework } = searchspring || {};
	const [_command, versionApply] = options.args;

	if (!searchspring || !context.project || !context.project.path || !framework || !projectVersion) {
		console.log(chalk.red(`Error: No Snap project found.`));
		exit(1);
	}

	// verify project version
	if (!projectVersion.match(/^\w?(\d+\.\d+\.\d+-?\d*)$/)) {
		console.log('Project version invalid.');
		exit(1);
	}

	const availablePatches = await getVersions(options);

	// verify requested version
	const versionMatch = /^^\w?(\d+\.\d+\.\d+)$/.exec(versionApply);
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
	console.log(chalk.blue(`\nfinalizing patch...`));
	await editJSON(options, 'package.json', [{ update: { properties: { searchspring: { version: finalVersion } } } }]);

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
	await copy(patchDir, projectPatchDir, { clobber: true });

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
				case 'run': {
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
				}
				case 'files': {
					const files = step[action];
					const fileGlobs = Object.keys(files);

					for (const fileGlob of fileGlobs) {
						const { action, changes } = files[fileGlob];

						try {
							// get filenames using glob - ignore `node_modules` and `patch` files
							const fileNames = glob.sync(fileGlob, { nosort: true, ignore: ['node_modules/**', 'patch/**'] });

							for (const fileName of fileNames) {
								const extension = fileName.split('.').pop();

								switch (action) {
									case 'edit-json': {
										if (['json'].includes(extension)) {
											console.log(`editing ${fileName}`);
											await editJSON(options, fileName, changes);
										}

										break;
									}
									case 'edit-yaml': {
										if (['yaml', 'yml'].includes(extension)) {
											console.log(`editing ${fileName}`);
											await editYAML(options, fileName, changes);
										}

										break;
									}
									default: {
										// FUTURE TODO: support editing other file types
										break;
									}
								}
							}
						} catch (err) {
							console.error(err);
							exit(1);
						}
					}
					break;
				}

				default: {
					break;
				}
			}
		}
	}
};
