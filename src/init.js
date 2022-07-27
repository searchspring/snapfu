import os from 'os';
import { exit, cwd } from 'process';
import { readdirSync, readFileSync, existsSync, mkdirSync, promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import inquirer from 'inquirer';
import clone from 'git-clone';
import sodium from 'tweetsodium';
import ncp from 'ncp';
import { auth } from './login.js';
import { getContext } from './context.js';
import { wait } from './utils/index.js';
import { ConfigApi } from './services/ConfigApi.js';

export const DEFAULT_BRANCH = 'production';

export const createDir = (dir) => {
	return new Promise((resolutionFunc, rejectionFunc) => {
		if (!existsSync(dir)) {
			mkdirSync(dir);
		}

		let folderName = dir.substring(dir.lastIndexOf('/') + 1);
		let files = readdirSync(dir);

		if (files.length !== 0) {
			rejectionFunc('folder not empty, exiting');
		}

		resolutionFunc(folderName);
	});
};

export const init = async (options) => {
	try {
		const { user } = options.context;

		let dir;
		if (options.args.length === 1) {
			// init was provided a folder name arg
			dir = path.join(cwd(), options.args[0]);
		} else {
			dir = cwd();
			console.log(chalk.yellow(`A parameter was not provided to the init command. The current working directory will be initialized.`));
		}

		let octokit = new Octokit({
			auth: user.token,
		});

		let orgs = await octokit.orgs.listForAuthenticatedUser().then(({ data }) => {
			return data.map((org) => {
				return org.login;
			});
		});

		const fetchTemplateRepos = async () => {
			let page = 0;
			let per_page = 100;
			let repos = [];
			let response;
			do {
				page++;
				response = await octokit.rest.repos.listForOrg({
					org: 'searchspring',
					type: 'public',
					per_page,
					page,
				});
				response.data.map((repo) => {
					repos.push(repo);
				});
			} while (response.data.length == per_page);
			return repos.filter((repo) => repo.name.startsWith(`snapfu-template-`));
		};

		let repos = await fetchTemplateRepos();

		if (!repos || !repos.length) {
			console.log(chalk.red('failed to fetch templates...'));
		} else {
			let questions = [
				{
					type: 'input',
					name: 'name',
					validate: (input) => {
						return input && input.length > 0;
					},
					message: 'Please choose the name of this repository:',
					default: path.basename(dir),
				},
				{
					type: 'list',
					name: 'framework',
					message: "Please choose the framework you'd like to use:",
					choices: ['preact'],
					default: 'preact',
				},
			];

			const answers1 = await inquirer.prompt(questions);

			let questions2 = [
				{
					type: 'list',
					name: 'template',
					message: "Please choose the template you'd like to use:",
					choices: repos.filter((repo) => repo.name.startsWith(`snapfu-template-${answers1.framework}`)),
					default: `snapfu-template-${answers1.framework}`,
				},
				{
					type: 'list',
					name: 'organization',
					message: 'Please choose which github organization to create this repository in:',
					choices: orgs.concat(user.login),
					default: 'searchspring-implementations',
					when: () => {
						return orgs && orgs.length > 0;
					},
				},
				{
					type: 'input',
					name: 'siteId',
					message: 'Please enter the siteId as found in the SMC console (a1b2c3):',
					validate: (input) => {
						return input && input.length > 0 && /^[0-9a-z]{6}$/.test(input);
					},
				},
				{
					type: 'input',
					name: 'secretKey',
					message: 'Please enter the secretKey as found in the SMC console (32 characters):',
					validate: (input) => {
						return input && input.length > 0 && /^[0-9a-zA-Z]{32}$/.test(input);
					},
				},
			];
			const answers2 = await inquirer.prompt(questions2);
			const answers = { ...answers1, ...answers2 };
			try {
				await new ConfigApi(answers.secretKey, options.dev).validateSite(answers.name, answers.siteId);
			} catch (err) {
				console.log(chalk.red('\nSite verification failed.'));
				console.log(chalk.red(err));
				exit(1);
			}

			// create local directory
			let folderName = await createDir(dir);

			// determine if using org or userspace
			let creationMethod = answers.organization == user.login ? 'createForAuthenticatedUser' : 'createInOrg';

			if (options.dev) {
				console.log(chalk.blueBright('\nSkipping new repo creation...'));
			} else {
				// create the remote repo
				console.log(`\nCreating repository...`);
				let exists = false;

				await octokit.repos[creationMethod]({
					org: answers.organization,
					name: answers.name,
					private: true,
					auto_init: true,
				})
					.then(() => console.log(chalk.cyan(`${answers.organization}/${answers.name}\n`)))
					.then(async () => {
						// giving github some time
						await wait(1000);

						// getting default branch name
						const response = await octokit.repos.get({
							owner: answers.organization,
							repo: answers.name,
						});

						const { default_branch } = response.data;

						if (default_branch !== DEFAULT_BRANCH) {
							console.log(`Renaming default branch ${chalk.cyan(default_branch)} to ${chalk.cyan(DEFAULT_BRANCH)}\n`);
							const response2 = await octokit.repos.renameBranch({
								owner: answers.organization,
								repo: answers.name,
								branch: default_branch,
								new_name: DEFAULT_BRANCH,
							});
						}
					})
					.catch((err) => {
						if (!err.message.includes('already exists')) {
							console.log(chalk.red(err.message));
							exit(1);
						} else {
							console.log(chalk.yellow('*** WARNING *** repository already exists\n'));
							exists = true;
						}
					});

				if (exists) {
					let question3 = [
						{
							type: 'confirm',
							name: 'continue',
							message: 'Do you want to continue? This may overwrite existing files in the repo.',
							default: false,
						},
					];

					let question4 = [
						{
							type: 'confirm',
							name: 'sure',
							message: 'Are you SURE? This may overwrite existing files in the repo.',
							default: false,
						},
					];

					const answers3 = await inquirer.prompt(question3);
					if (answers3.continue) {
						const answers4 = await inquirer.prompt(question4);
						if (!answers4.sure) {
							console.log(chalk.yellow('aborting...\n'));
							exit(1);
						}
					} else {
						console.log(chalk.yellow('aborting...\n'));
						exit(1);
					}

					// new line
					console.log();
				}
			}

			// newly create repo URLs
			const repoUrlSSH = `git@github.com:${creationMethod == 'createInOrg' ? answers.organization : user.login}/${answers.name}.git`;
			const repoUrlHTTP = `https://${user.login}@github.com/${creationMethod == 'createInOrg' ? answers.organization : user.login}/${answers.name}`;

			// template repo URLs
			const templateUrlSSH = `git@github.com:searchspring/${answers.template}.git`;
			const templateUrlHTTP = `https://github.com/searchspring/${answers.template}`;

			if (!options.dev) {
				try {
					console.log(`Cloning repository via SSH...`);
					await cloneAndCopyRepo(repoUrlSSH, dir, false);
					console.log(`${chalk.cyan(repoUrlSSH)}\n`);
				} catch (err) {
					console.log(`SSH authentication failed. Cloning repository via HTTPS...`);
					await cloneAndCopyRepo(repoUrlHTTP, dir, false);
					console.log(`${chalk.cyan(repoUrlHTTP)}\n`);
				}
			}

			try {
				console.log(`Cloning template into ${dir} via SSH...`);
				await cloneAndCopyRepo(templateUrlSSH, dir, true, {
					'snapfu.name': answers.name,
					'snapfu.siteId': answers.siteId,
					'snapfu.author': user.name,
					'snapfu.framework': answers.framework,
				});
				console.log(`${chalk.cyan(templateUrlSSH)}\n`);
			} catch (err) {
				console.log(`SSH authentication failed. Cloning template into ${dir} via HTTPS...`);
				await cloneAndCopyRepo(templateUrlHTTP, dir, true, {
					'snapfu.name': answers.name,
					'snapfu.siteId': answers.siteId,
					'snapfu.author': user.name,
					'snapfu.framework': answers.framework,
				});
				console.log(`${chalk.cyan(templateUrlHTTP)}\n`);
			}

			// waiting here due to copyPromise function resolving before template is actually copied
			// TODO: look into why ncp does not like our filtering (does not resolve promise in callback)
			// wait...
			await wait(1000);

			// save secretKey mapping to creds.json
			await auth.saveSecretKey(answers.secretKey, answers.siteId);
			await setRepoSecret(options, {
				siteId: answers.siteId,
				secretKey: answers.secretKey,
				organization: answers.organization,
				name: answers.name,
				dir,
			});
			await setBranchProtection(options, { organization: answers.organization, name: answers.name });
			if (dir != cwd()) {
				console.log(`The ${chalk.blue(folderName)} directory has been created and initialized from ${chalk.blue(`${answers.template}`)}.`);
				console.log(`Get started by installing package dependencies and creating a branch:`);
				console.log(chalk.grey(`\n\tcd ${folderName} && npm install && git checkout -b development\n`));
			} else {
				console.log(`Current working directory has been initialized from ${chalk.blue(`${answers.template}`)}.`);
				console.log(`Get started by installing package dependencies and creating a branch:`);
				console.log(chalk.grey(`\n\tnpm install && git checkout -b development\n`));
			}
		}
	} catch (err) {
		console.log(chalk.red(err));
		exit(1);
	}
};

export const setBranchProtection = async function (options, details) {
	const { user } = options.context;

	let octokit = new Octokit({
		auth: user.token,
	});

	const { organization, name } = details;

	if (!options.dev && organization && name) {
		console.log(`Setting branch protection for ${DEFAULT_BRANCH} in ${organization}/${name}...`);

		try {
			// create branch protection rule for 'production' branch
			const branchProtectionResponse = await octokit.rest.repos.updateBranchProtection({
				owner: organization,
				repo: name,
				branch: DEFAULT_BRANCH,
				required_status_checks: {
					strict: false,
					checks: [
						{
							context: 'Snap Action',
						},
					],
				},
				enforce_admins: true,
				required_pull_request_reviews: {
					dismiss_stale_reviews: true,
					required_approving_review_count: 0,
				},
				restrictions: null,
			});

			if (branchProtectionResponse && branchProtectionResponse.status === 200) {
				console.log(chalk.green(`created branch protection for ${DEFAULT_BRANCH}`));
			} else {
				console.log(chalk.red(`failed to create branch protection rule`));
			}
		} catch (err) {
			console.log(chalk.red(`failed to create branch protection rule`));
			console.log(chalk.red(err));
		}
	} else {
		console.log(chalk.yellow('skipping creation of branch protection'));
	}
	console.log(); // new line spacing
};

export const setRepoSecret = async function (options, details) {
	const initContext = await getContext(details.dir);
	const { user } = options.context;

	let octokit = new Octokit({
		auth: user.token,
	});

	const { siteId, secretKey, organization, name } = details;

	if (!options.dev && siteId && secretKey) {
		// get repo public-key used for encrypting secerts
		const keyResponse = await octokit.actions.getRepoPublicKey({
			owner: organization,
			repo: name,
		});

		if (keyResponse && keyResponse.status === 200 && keyResponse.data) {
			const { key, key_id } = keyResponse.data;
			const value = secretKey;
			let secret_name = 'WEBSITE_SECRET_KEY';

			if (typeof initContext.searchspring.siteId === 'object') {
				secret_name = `WEBSITE_SECRET_KEY_${siteId.toUpperCase()}`; // github converts to uppercase, setting explicitly for the logging
			}

			// Convert the message and key to Uint8Array's (Buffer implements that interface)
			const messageBytes = Buffer.from(value);
			const keyBytes = Buffer.from(key, 'base64');
			// Encrypt using LibSodium.
			const encryptedBytes = sodium.seal(messageBytes, keyBytes);
			// Base64 the encrypted secret
			const encrypted_value = Buffer.from(encryptedBytes).toString('base64');

			// create or update secret
			console.log(`Setting secret key for repository in ${organization}/${name}...`);
			const secretResponse = await octokit.actions.createOrUpdateRepoSecret({
				owner: organization,
				repo: name,
				secret_name,
				encrypted_value,
				key_id,
			});

			if (secretResponse && secretResponse.status === 201) {
				console.log(chalk.green(`created ${secret_name} in ${organization}/${name}`));
			} else if (secretResponse && secretResponse.status === 204) {
				console.log(chalk.green(`updated ${secret_name} in ${organization}/${name}`));
			} else {
				console.log(chalk.red(`failed to create repository secret`));
			}
		} else {
			console.log(chalk.red(`failed to create repository secret`));
		}
	} else {
		console.log(chalk.yellow('skipping creation of repository secret'));
	}
	console.log(); // new line spacing
};

export const cloneAndCopyRepo = async function (sourceRepo, destination, excludeGit, transforms) {
	let folder = await fs.mkdtemp(path.join(os.tmpdir(), 'snapfu-temp')).then(async (folder, err) => {
		if (err) throw err;
		return folder;
	});

	await clonePromise(sourceRepo, folder);
	let options = { clobber: true };

	if (excludeGit) {
		options.filter = (name) => {
			return !name.endsWith('/.git');
		};
	}

	if (transforms) {
		options.transform = async (read, write, file) => {
			await transform(read, write, transforms, file);
		};
	}

	await copyPromise(folder, destination, options);
};

export const transform = async function (read, write, transforms, file) {
	if (
		file.name.endsWith('.md') ||
		file.name.endsWith('.html') ||
		file.name.endsWith('.json') ||
		file.name.endsWith('.yml') ||
		file.name.endsWith('index.js')
	) {
		let content = await streamToString(read);

		Object.keys(transforms).forEach(function (key) {
			let t = transforms[key];
			let r = new RegExp('{{\\s*' + key + '\\s*}}', 'gi');
			content = content.replace(r, t);
		});

		write.write(content);
	} else {
		read.pipe(write);
	}
};

async function streamToString(stream) {
	let bytes = await streamToByte(stream);
	return bytes.toString('utf8');
}

async function streamToByte(stream) {
	const chunks = [];

	return new Promise((resolve, reject) => {
		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('error', reject);
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});
}

function clonePromise(repoUrl, destination) {
	return new Promise((resolutionFunc, rejectionFunc) => {
		clone(repoUrl, destination, (err) => {
			if (err) {
				rejectionFunc(err);
			}
			resolutionFunc();
		});
	});
}

function copyPromise(source, destination, options) {
	return new Promise((resolutionFunc, rejectionFunc) => {
		// ncp can be used to modify the files while copying - see https://www.npmjs.com/package/ncp
		ncp(source, destination, options, function (err) {
			if (err) {
				rejectionFunc(err);
			}
			resolutionFunc();
		});
		resolutionFunc();
	});
}
