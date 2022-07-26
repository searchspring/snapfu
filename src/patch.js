import { existsSync, mkdirSync, promises as fsp } from 'fs';
import path from 'path';
import { exit } from 'process';
import chalk from 'chalk';
import { auth } from './login';
import { commandOutput } from './context';
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
	const { searchspring, version } = context;
	const { framework } = searchspring || {};

	// versions.forEach(version => {
	//     console.log(chalk.white(version))
	// });

	// determine patch path based on version provided and project version
};

const getVersions = async (options) => {
	const { context } = options;
	const { searchspring, version } = context;
	const { framework } = searchspring || {};

	// ~/.searchspring/snapfu-patches/{framework}/{version}
	const patchVersions = await fsp.readdir(path(PATCH_DIR, framework));
	const versions = [];
	for (const file of patchVersions) {
		const fileStats = await fsp.statSync(file);
		if (fileStats.isDirectory()) {
			versions.push(file);
		}
	}
	return versions;
};

export const applyPatch = async (options) => {
	await setupPatchRepo(options);
};
