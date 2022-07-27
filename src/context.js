import { exit } from 'process';
import path from 'path';
import { promises as fsp } from 'fs';
import chalk from 'chalk';

import { auth } from './login.js';
import { commandOutput } from './utils/index.js';

export async function getContext(dir) {
	let user, project, searchspring, branch, remote, organization, name, projectVersion;

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
		projectVersion = packageContext.version;
	} catch (err) {
		// do nothing
	}

	try {
		branch = await (await commandOutput('git branch --show-current', dir)).stdout.trim();
		remote = await commandOutput('git config --get remote.origin.url', dir).stdout.trim();
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

	let packageJSON = {};
	try {
		const executionPath = process.argv[1];
		const snapfuPath = path.dirname(executionPath);
		let dirName;
		try {
			dirName = __dirname;
		} catch (e) {
			dirName = snapfuPath;
		}
		const snapfuPackageJSON = path.join(dirName, '../package.json');
		const contents = await fsp.readFile(snapfuPackageJSON, 'utf8');
		packageJSON = JSON.parse(contents);
	} catch (e) {
		console.log('Could not determine Snapfu version.', e);
		exit(1);
	}

	return {
		user,
		project,
		repository: {
			remote,
			name,
			organization,
			branch,
		},
		searchspring,
		projectVersion,
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
