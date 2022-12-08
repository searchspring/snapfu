import child_process from 'child_process';
import { exit } from 'process';
import { promisify } from 'util';
import path from 'path';
import { promises as fsp } from 'fs';
import chalk from 'chalk';

import { auth } from './login';
import packageJSON from '../package.json';

const exec = promisify(child_process.exec);

export async function commandOutput(cmd, dir) {
	try {
		const { err, stdout, stderr } = await exec(cmd, { cwd: dir });
		if (err) throw 'error';

		return stdout.trim();
	} catch (err) {
		// cannot get branch details
	}
}

export async function getContext(dir) {
	let user, project, searchspring, branch, branchList, remote, organization, name;

	try {
		user = await auth.loadCreds();
	} catch (err) {
		// set empty keys
		user = { keys: {} };
	}

	try {
		const packageContext = await getPackageJSON(dir);

		project = packageContext.project;
		searchspring = packageContext.searchspring;
	} catch (err) {
		// do nothing
	}

	try {
		branchList = await commandOutput('git branch', dir);
		branch = await commandOutput('git branch --show-current', dir);
		remote = await commandOutput('git config --get remote.origin.url', dir);
	} catch (err) {
		// do nothing
	}

	if (remote) {
		// get repo org and name from remote (URL is either HTTPS or SSH)
		[organization, name] = remote
			.replace(/^git@github.com:/, '')
			.replace(/^https:\/\/github.com\//, '')
			.replace(/.git$/, '')
			.split('/');
	}

	return {
		user,
		project,
		repository: {
			remote,
			name,
			organization,
			branch,
			branchList,
		},
		searchspring,
		version: packageJSON.version,
	};
}

export async function getPackageJSON(dir) {
	try {
		const [packageFile] = await getClosest(dir || process.cwd(), 'package.json');

		if (packageFile) {
			const contents = await fsp.readFile(packageFile, 'utf8');
			const parsedContents = JSON.parse(contents);

			parsedContents.project = {
				path: path.dirname(packageFile),
				dirname: path.basename(path.dirname(packageFile)),
			};

			return parsedContents;
		}

		return {};
	} catch (err) {
		throw err;
	}
}

export async function getClosest(dir, fileName) {
	const rootDir = path.parse(dir).root;
	let results = [];

	try {
		const dirFiles = await fsp.readdir(dir);

		for (const file of dirFiles) {
			const filePath = path.resolve(dir, file);

			if (file == fileName) {
				results.push(filePath);
			}
		}

		if (!results.length && dir != rootDir) {
			const dirResults = await getClosest(path.resolve(dir, '../'), fileName);
			results = results.concat(dirResults);
		}
	} catch (err) {
		throw new Error('failed to getFiles!');
	}

	return results;
}
