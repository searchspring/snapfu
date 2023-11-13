import { exit } from 'process';
import path from 'path';
import { promises as fsp } from 'fs';
import chalk from 'chalk';

import { auth } from './login.js';
import { commandOutput } from './utils/index.js';

export async function getContext(dir) {
	let project, searchspring, branch, branchList, remote, organization, name, projectVersion;
	try {
		const packageContext = await getPackageJSON(dir);

		project = packageContext?.project;
		searchspring = packageContext?.searchspring;
		projectVersion = searchspring?.version || '0.0.0';
	} catch (err) {
		// do nothing
	}

	try {
		branchList = (await commandOutput('git branch', dir)).stdout.trim();
		branch = (await commandOutput('git branch --show-current', dir)).stdout.trim();
		remote = (await commandOutput('git config --get remote.origin.url', dir)).stdout.trim();
	} catch (err) {
		// do nothing
	}

	if (remote) {
		// Removing the .git at the end
		remote = remote.replace('.git', '');

		let path = [];

		// If URL contains an @ it's an SSH repository URL
		if (remote.indexOf('@') > -1) {
			// Splitting the string at the : and taking the second value
			path = remote.split(':')[1]?.split('/');
		} else {
			// Just split the string at /
			path = remote?.split('/');
		}
		
		if(path && path.length > 1) {
			// Name is the last value in the path
			name = path[path.length - 1];

			// Organization is the second to last value in the path
			organization = path[path.length - 2];
		}
	}

	return {
		project,
		repository: {
			remote,
			name,
			organization,
			branch,
			branchList,
		},
		searchspring,
		projectVersion,
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
