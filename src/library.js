/*

	Commands needing components:
	* recs init

	* utilize snapfu-library repository
	* use `ncp` to copy files from repo to project
	* need functions for:
		* clone/fetch repo
		* install component
		* list components (per framework / type)
	
	snapfu-library https://github.com/searchspring/snapfu-library

	* sanitize name from inquirer to support only variablesNames

*/

import { existsSync, mkdirSync, promises as fsp, statSync } from 'fs';
import { exit } from 'process';
import path from 'path';
import chalk from 'chalk';

import { commandOutput } from './utils/index.js';

export const setupLibraryRepo = async (options) => {
	// clone or pull snapfu library repository
	try {
		if (!existsSync(options.config.searchspringDir)) {
			mkdirSync(options.config.searchspringDir);
		}
		if (existsSync(options.config.library.dir)) {
			console.log(`Updating ${options.config.library.repoName}...`);
			const { stdout, stderr } = await commandOutput(`git pull`, options.config.library.dir);
			// console.log(stdout || stderr);
		} else {
			console.log(`Cloning ${options.config.library.repoName} into ${options.config.library.dir} ...`);
			const { stdout, stderr } = await commandOutput(
				`git clone ${options.config.library.repoUrl} ${options.config.library.repoName}`,
				options.config.searchspringDir
			);
			// console.log(stdout || stderr);
		}
	} catch (e) {
		console.log(chalk.red(`Failed to update library files!`));
		// console.log(chalk.red(e));
		exit(1);
	}
};

export const buildLibrary = async (options) => {
	await setupLibraryRepo(options);

	// build library object from files in repo
	/*
		const library = {
			preact: {
				components: {
					...
				},
				patches: {
					... TODO Later
				}
			}
		}
	*/

	const { context } = options;
	const { searchspring } = context;

	if (!searchspring || !context.project.path) {
		console.log(chalk.red(`Error: No Snap project found in ${process.cwd()}.`));
		return;
	}

	const { framework } = searchspring || {};

	// ~/.searchspring/snapfu-library/{framework}
	const frameworkPath = path.join(options.config.library.dir, framework);
	const frameworkDirExists = existsSync(frameworkPath);
	const library = {};

	if (frameworkDirExists) {
		const components = await buildLibraryComponents(path.join(frameworkPath, 'components'), options);
		// const patches = buildLibraryPatches(path);

		library[framework] = {
			components,
			// patches,
		};
	}

	return library;
};

export const buildLibraryComponents = async (dir, options) => {
	// ~/.searchspring/snapfu-library/{framework}/{components}
	const componentsDirContents = await fsp.readdir(dir);

	const components = {};
	// component categories (recommendation/badge)
	for (const categoryFile of componentsDirContents) {
		const filePath = path.resolve(dir, categoryFile);
		const fileStats = await statSync(filePath);
		if (fileStats.isDirectory()) {
			const componentCategory = {};

			// parse contents of component category to get component details
			const componentCategoryContents = await fsp.readdir(filePath);

			for (const componentFile of componentCategoryContents) {
				const componentFilePath = path.resolve(filePath, componentFile);
				const componentFileStats = await statSync(componentFilePath);
				if (componentFileStats.isDirectory()) {
					// get contents and set files

					const componentContents = await fsp.readdir(componentFilePath);
					// ['Default.jsx', 'Default.tsx', 'Default.scss']
					// exclude files based on project type (javascript|typescript)
					const filteredComponentContents = componentContents.filter((fileName) => {
						if (options.context.project.type === 'typescript') {
							return !(fileName.endsWith('.jsx') || fileName.endsWith('.js'));
						} else {
							return !(fileName.endsWith('.tsx') || fileName.endsWith('.ts'));
						}
					});

					componentCategory[componentFile] = {
						path: componentFilePath,
						label: componentFile,
						files: filteredComponentContents,
					};
				}
			}

			// add component entries if some were found
			if (Object.keys(componentCategory)?.length > 0) {
				components[categoryFile] = componentCategory;
			}
		}
	}

	return components;
};
