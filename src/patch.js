import { existsSync, mkdirSync, promises as fsp, statSync } from 'fs';
import path from 'path';
import { exit } from 'process';
import chalk from 'chalk';
import { auth } from './login';
import { commandOutput } from './context';
import { cmp } from './utils';
/*

Usage examples:

snapfu patch apply latest
(no version should patch to latest)

snapfu patch apply v0.33.0
(with version patch to version)

snapfu patch list
(show versions available)

snapfu patch help

since running in a snap project we would know the framework
if no context found we should exit with (no snap project found)

1. clone / pull patch repo
	+ should live in ~/.searchspring/snap-patches
2.

*/

const REPO_NAME = 'snapfu-patches';
const PATCH_REPO = `git@github.com:searchspring/${REPO_NAME}.git`;
const SEARCHSPRING_DIR = path.join(auth.home(), '/.searchspring');
const PATCH_DIR = path.join(SEARCHSPRING_DIR, REPO_NAME);

const setupPatchRepo = async (options) => {
	const { context } = options;
	const { searchspring, version } = context;
	const { framework } = searchspring || {};

	if (!searchspring || !context.project || !context.project.path || !framework || !version) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	// clone or pull snapfu patches repository
	try {
		if (!existsSync(SEARCHSPRING_DIR)) {
			mkdirSync(SEARCHSPRING_DIR);
		}
		if (existsSync(PATCH_DIR)) {
			console.log(`Updating ${REPO_NAME}...`);
			const { stdout, stderr } = await commandOutput(`git pull`, PATCH_DIR);
			console.log(stdout || stderr);
		} else {
			console.log(`Cloning ${REPO_NAME} into ${PATCH_DIR} via SSH...`);
			const { stdout, stderr } = await commandOutput(`git clone ${PATCH_REPO} ${REPO_NAME}`, SEARCHSPRING_DIR);
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
	const allPatchVersions = await getVersions(options);

	const { context } = options;
	const { projectVersion } = context;

	if (!projectVersion) {
		console.log(chalk.red(`Could not find project version in package.json`));
		exit(1);
	}
	const availablePatches = allPatchVersions.sort(cmp).filter((version) => cmp(version, projectVersion) === 1);
	const previousPatches = allPatchVersions.sort(cmp).filter((version) => cmp(version, projectVersion) !== 1);

	if (previousPatches.length > 1) {
		console.log(chalk.white.bold(`Patches Already Applied:`), chalk.white(previousPatches.length - 1));
	}

	console.log(chalk.white.bold(`Current Project Version:`), chalk.bold.cyan(projectVersion));

	if (availablePatches.length) {
		console.log(chalk.white.bold('Available Patches:'));
	}
	availablePatches.forEach((version) => {
		console.log(chalk.white(version));
	});
};

const getVersions = async (options) => {
	const { context } = options;
	const { searchspring, version } = context;
	const { framework } = searchspring || {};

	// ~/.searchspring/snapfu-patches/{framework}/{version}
	const frameworkPath = path.join(PATCH_DIR, framework);
	const patchVersions = await fsp.readdir(path.join(frameworkPath));
	const versions = [];
	for (const file of patchVersions) {
		const filePath = path.resolve(frameworkPath, file);
		const fileStats = await statSync(filePath);
		if (fileStats.isDirectory()) {
			versions.push(file);
		}
	}
	return versions;
};

export const applyPatch = async (options) => {
	await setupPatchRepo(options);
};
