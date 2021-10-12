import child_process from 'child_process';
import { exit } from 'process';
import { promisify } from 'util';
import path from 'path';
import { promises as fsp } from 'fs';
import chalk from 'chalk';

import { auth } from './login';
import packageJSON from '../package.json';

const exec = promisify(child_process.exec);

export async function commandOutput(cmd) {
	try {
		const { err, stdout, stderr } = await exec(cmd);
		if (err) throw 'error';

		return stdout.trim();
	} catch (err) {
		// cannot get branch details
	}
}

export async function getContext() {
	let user, project, searchspring, branch, remote, organization, name;

	try {
		user = await auth.loadCreds();
	} catch (err) {
		// do nothing
	}

	try {
		const packageContext = await getPackageJSON();

		project = packageContext.project;
		searchspring = packageContext.searchspring;
	} catch (err) {
		// do nothing
	}

	try {
		branch = await commandOutput('git branch --show-current');
		remote = await commandOutput('git config --get remote.origin.url');
	} catch (err) {
		// do nothing
	}

	if (remote) {
		// get repo org and name from remote
		// git@github.com:searchspring-implementations/demo.shopify.git
		// https://github.com/searchspring-implementations/demo.shopify.git
		// https://github.com/korgon/koatokensocketvue.git
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
		},
		searchspring,
		version: packageJSON.version,
	};
}

export async function getPackageJSON() {
	try {
		const [packageFile] = await getClosest(process.cwd(), 'package.json');

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
	const rootDir = path.parse(process.cwd()).root;
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
