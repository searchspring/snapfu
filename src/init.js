import os from 'os';
import { exit, cwd } from 'process';
import { readdirSync, readFileSync, existsSync, mkdirSync, promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import libsodium from 'libsodium-wrappers';
import { auth } from './login.js';
import { getContext } from './context.js';
import { commandOutput, wait, copy, copyTransform } from './utils/index.js';
import { ConfigApi } from './services/ConfigApi.js';
import YAML from 'yaml';

export const DEFAULT_BRANCH = 'production';

export const createDir = (dir) => {
	return new Promise((resolutionFunc, rejectionFunc) => {
		if (!existsSync(dir)) {
			mkdirSync(dir);
		}

		let folderName = dir.substring(dir.lastIndexOf('/') + 1);
		let files = readdirSync(dir);

		if (files.length !== 0) {
			rejectionFunc(`Cannot initialize non-empty directory: ${dir}`);
		}

		resolutionFunc(folderName);
	});
};

export const init = async (options) => {
	try {
		const { user } = options;

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
			request: {
				fetch: fetch,
			},
		});

		let orgs = await octokit.orgs.listForAuthenticatedUser().then(({ data }) => {
			return data.map((org) => {
				return org.login;
			});
		});

		const fetchScaffoldRepos = async () => {
			// using search modifiers - https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
			const searchOrgs = orgs
				.concat(user.login)
				.concat('searchspring')
				.map((org) => `org:${org}`);

			let page = 0;
			let per_page = 100;
			let repos = [];
			let response;
			do {
				page++;
				response = await octokit.rest.search.repos({
					q: `snapfu-scaffold-+archived:false+${searchOrgs.join('+')}`,
					per_page,
					page,
				});

				response.data?.items?.map((repo) => {
					repos.push(repo);
				});
			} while (response.data?.items.length == per_page);
			return repos.filter((repo) => repo.name.startsWith(`snapfu-scaffold-`));
		};

		const snapfuScaffoldRepos = await fetchScaffoldRepos();

		if (!snapfuScaffoldRepos?.length) {
			console.log(chalk.red('failed to fetch scaffolds...'));
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

			// filter out repos that apply to the framework
			const scaffoldRepos = snapfuScaffoldRepos
				.filter((repo) => repo.name.startsWith(`snapfu-scaffold-${answers1.framework}`))
				.map((repo) => repo.full_name)
				.sort();

			const scaffolds = {};
			// map repos
			scaffoldRepos.forEach((repository) => {
				const [owner, repo] = repository.split('/');

				scaffolds[repository] = {
					repo,
					owner,
					ssh: `git@github.com:${repository}.git`,
					http: `https://github.com/${repository}`,
				};
			});

			if (user?.settings?.scaffolds?.repositories?.length) {
				// add separator for clear delimiting
				const capitalizedFramework = answers1.framework.charAt(0).toUpperCase() + answers1.framework.slice(1);

				scaffoldRepos.unshift(new inquirer.Separator(`Snapfu ${capitalizedFramework} Scaffolds`));
				scaffoldRepos.push(new inquirer.Separator('Custom Scaffolds'));

				// loop through custom repos and add to scaffoldRepos list and scaffolds mapping
				user.settings.scaffolds.repositories.forEach((url) => {
					// supporting HTTP only list for now
					const split = url.split('/');

					if (split.length > 2) {
						const repo = split[split.length - 1];
						const owner = split[split.length - 2];
						const repository = `${owner}/${repo}`;

						scaffoldRepos.push(repository);

						scaffolds[repository] = {
							repo,
							owner,
							ssh: `git@github.com:${repository}.git`,
							http: url,
						};
					}
				});
			}

			const questions2 = [
				{
					type: 'list',
					name: 'scaffold',
					message: "Please choose the scaffold you'd like to use:",
					choices: scaffoldRepos,
					default: `snapfu-scaffold-${answers1.framework}`,
				},
			];

			const answers2 = await inquirer.prompt(questions2);

			// scaffold reference
			const scaffold = scaffolds[answers2.scaffold];
			if (!scaffold) {
				console.log(chalk.red(`Failed to find the selected scaffold ${answers2.scaffold}...\n`));
				exit(1);
			}

			try {
				const contentResponse = await octokit.rest.repos.getContent({
					owner: scaffold.owner,
					repo: scaffold.repo,
					path: 'snapfu.config.yml',
				});

				try {
					const buffer = new Buffer.from(contentResponse.data.content, 'base64');
					const fileContents = buffer.toString('ascii');
					scaffold.advanced = YAML.parse(fileContents);
				} catch (err) {
					console.log(chalk.red(`Failed to parse snapfu.config.yml contents...\n`));
					exit(1);
				}
			} catch (err) {
				if (err.status !== 404) {
					console.log(chalk.red(`Failed to fetch snapfu.config.yml...\n`));
					exit(1);
				}
			}

			// ask additional questions (for advanced scaffolds)
			if (scaffold.advanced?.variables?.length) {
				let advancedQuestions = [];
				scaffold.advanced.variables.forEach((variable) => {
					if (variable.name && variable.type && variable.message) {
						// remove the value
						delete variable.value;
						advancedQuestions.push(variable);
					}
				});

				scaffold.answers = await inquirer.prompt(advancedQuestions);
			}

			const questions3 = [
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
			const answers3 = await inquirer.prompt(questions3);

			// combined answers
			const answers = { ...answers1, ...answers2, ...answers3 };

			// validate siteId and secretKey
			try {
				await new ConfigApi(answers.secretKey, options.dev).validateSite(answers.siteId);
			} catch (err) {
				console.log(chalk.red('\nSite verification failed.'));
				console.log(chalk.red(err));
				exit(1);
			}

			// create local directory
			let folderName = await createDir(dir);

			// set organization to user.login when answer is undefined (question never asked)
			answers.organization = answers.organization || user.login;

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

			const scaffoldVariables = {
				'snapfu.name': answers.name,
				'snapfu.siteId': answers.siteId,
				'snapfu.author': user.name,
				'snapfu.framework': answers.framework,
			};

			// add advanced scaffold variables
			if (scaffold.answers) {
				Object.keys(scaffold.answers).forEach((key) => {
					const value = scaffold.answers[key];
					scaffoldVariables[`snapfu.variables.${key}`] = value;
				});
			}

			try {
				console.log(`Cloning scaffolding into ${dir} via SSH...`);
				await cloneAndCopyRepo(scaffold.ssh, dir, true, scaffoldVariables);
				console.log(`${chalk.cyan(scaffold.ssh)}\n`);
			} catch (err) {
				console.log(`SSH authentication failed. Cloning scaffolding into ${dir} via HTTPS...`);
				await cloneAndCopyRepo(scaffold.http, dir, true, scaffoldVariables);
				console.log(`${chalk.cyan(scaffold.http)}\n`);
			}

			// waiting here due to copyPromise function resolving before scaffold is actually copied
			// TODO: look into why ncp does not like our filtering (does not resolve promise in callback)
			// wait...
			await wait(1000);

			// save secretKey mapping to creds.json
			await auth.saveSecretKey(answers.secretKey, answers.siteId, options.config.searchspringDir);
			await setRepoSecret(options, {
				siteId: answers.siteId,
				secretKey: answers.secretKey,
				organization: answers.organization,
				name: answers.name,
				dir,
			});

			await setBranchProtection(options, { organization: answers.organization, name: answers.name });

			if (dir != cwd()) {
				console.log(`The ${chalk.blue(folderName)} directory has been created and initialized from ${chalk.blue(`${answers.scaffold}`)}.`);
				console.log(`Get started by installing package dependencies and creating a branch:`);
				console.log(chalk.grey(`\n\tcd ${folderName} && npm install && git checkout -b development\n`));
			} else {
				console.log(`Current working directory has been initialized from ${chalk.blue(`${answers.scaffold}`)}.`);
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
	const { user } = options;

	let octokit = new Octokit({
		auth: user.token,
		request: {
			fetch: fetch,
		},
	});

	const { organization, name } = details;

	if (!options.dev && organization && name) {
		console.log(`Setting branch protection for ${DEFAULT_BRANCH} in ${organization}/${name}...`);

		try {
			// create branch protection rule for 'production' branch
			const branchProtectionResponse = await octokit.rest.repos.createRepoRuleset({
				owner: organization,
				repo: name,
				name: 'Production',
				target: 'branch',
				enforcement: 'active',
				conditions: {
					ref_name: {
						exclude: [],
						include: [`refs/heads/${DEFAULT_BRANCH}`],
					},
				},
				rules: [
					{
						type: 'required_status_checks',
						parameters: {
							strict_required_status_checks_policy: false,
							do_not_enforce_on_create: false,
							required_status_checks: [
								{
									context: 'Snap Action',
								},
							],
						},
					},
					{
						type: 'deletion',
					},
					{
						type: 'pull_request',
						parameters: {
							required_approving_review_count: 0,
							dismiss_stale_reviews_on_push: true,
							require_code_owner_review: false,
							require_last_push_approval: false,
							required_review_thread_resolution: true,
							automatic_copilot_code_review_enabled: true,
							allowed_merge_methods: ['merge', 'squash', 'rebase'],
						},
					},
					{
						type: 'copilot_code_review',
						parameters: {
							review_on_push: false,
							review_draft_pull_requests: false,
						},
					},
				],
			});

			if (branchProtectionResponse && branchProtectionResponse.status === 201) {
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
	const { user } = options;

	let octokit = new Octokit({
		auth: user.token,
		request: {
			fetch: fetch,
		},
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

			await libsodium.ready;
			// Encrypt using LibSodium.
			const encryptedBytes = libsodium.crypto_box_seal(messageBytes, keyBytes);
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

export const cloneAndCopyRepo = async function (sourceRepo, destination, excludeFiles, variables) {
	let folder = await fs.mkdtemp(path.join(os.tmpdir(), 'snapfu-temp')).then(async (folder, err) => {
		if (err) throw err;
		return folder;
	});

	// clone scaffold repo into temp dir
	await commandOutput(`git clone ${sourceRepo} ${folder}`);

	let options = { clobber: true };

	if (excludeFiles) {
		const excludeList = ['.git', 'snapfu.config.yml'];

		// filter out files in the exclude list
		options.filter = (name) => excludeList.every((entry) => name != `${folder}/${entry}`);
	}

	if (variables) {
		options.transform = async (read, write, file) => {
			await copyTransform(read, write, variables, file);
		};
	}

	// copy from temp dir to destination (with optional transforms)
	await copy(folder, destination, options);
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
