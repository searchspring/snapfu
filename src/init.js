import os from 'os';
import { exit, cwd } from 'process';
import { readdirSync, readFileSync, existsSync, mkdirSync, promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import inquirer from 'inquirer';
import sodium from 'tweetsodium';
import ncp from 'ncp';
import replaceStream from 'replacestream';
import { auth } from './login.js';
import { getContext } from './context.js';
import { commandOutput, wait } from './utils/index.js';
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
			rejectionFunc('folder not empty, exiting');
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
		});

		let orgs = await octokit.orgs.listForAuthenticatedUser().then(({ data }) => {
			return data.map((org) => {
				return org.login;
			});
		});

		const fetchTemplateRepos = async () => {
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
					q: `snapfu-template-+archived:false+${searchOrgs.join('+')}`,
					per_page,
					page,
				});

				console.log('response?', response);
				response.data?.items?.map((repo) => {
					repos.push(repo);
				});
			} while (response.data?.items.length == per_page);
			return repos.filter((repo) => repo.name.startsWith(`snapfu-template-`));
		};

		const snapfuTemplateRepos = await fetchTemplateRepos();

		if (!snapfuTemplateRepos?.length) {
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

			// filter out repos that apply to the framework
			const templateRepos = snapfuTemplateRepos
				.filter((repo) => repo.name.startsWith(`snapfu-template-${answers1.framework}`))
				.map((repo) => repo.full_name)
				.sort();

			const templates = {};
			// map repos
			templateRepos.forEach((repo) => {
				templates[repo] = {
					repo,
					owner: 'searchspring',
					ssh: `git@github.com:searchspring/${repo}.git`,
					http: `https://github.com/searchspring/${repo}`,
				};
			});

			if (user?.settings?.templates?.repositories?.length) {
				// add separator for clear delimiting
				const capitalizedFramework = answers1.framework.charAt(0).toUpperCase() + answers1.framework.slice(1);

				templateRepos.unshift(new inquirer.Separator(`Snapfu ${capitalizedFramework} Templates`));
				templateRepos.push(new inquirer.Separator('Custom Templates'));

				// loop through custom repos and add to templateRepos list and templates mapping
				user.settings.templates.repositories.forEach((url) => {
					// supporting HTTP only list for now
					const split = url.split('/');

					if (split.length > 2) {
						const repo = split[split.length - 1];
						const owner = split[split.length - 2];

						templateRepos.push(repo);

						templates[repo] = {
							repo,
							owner,
							ssh: `git@github.com:${owner}/${repo}.git`,
							http: url,
						};
					}
				});
			}

			const questions2 = [
				{
					type: 'list',
					name: 'template',
					message: "Please choose the template you'd like to use:",
					choices: templateRepos,
					default: `snapfu-template-${answers1.framework}`,
				},
			];

			const answers2 = await inquirer.prompt(questions2);

			// template reference
			const template = templates[answers2.template];
			if (!template) {
				console.log(chalk.red(`Failed to find the selected template ${answers2.template}...\n`));
				exit(1);
			}

			try {
				const contentResponse = await octokit.rest.repos.getContent({
					owner: template.owner,
					repo: template.repo,
					path: 'snapfu.yml',
				});

				try {
					const buffer = new Buffer.from(contentResponse.data.content, 'base64');
					const fileContents = buffer.toString('ascii');
					template.advanced = YAML.parse(fileContents);
				} catch (err) {
					console.log(chalk.red(`Failed to parse snapfu.yml contents...\n`));
					exit(1);
				}
			} catch (err) {
				if (err.status !== 404) {
					console.log(chalk.red(`Failed to fetch snapfu.yml...\n`));
					exit(1);
				}
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

			// ask additional questions (for advanced templates)
			if (template.advanced?.variables?.length) {
				console.log(chalk.gray(`\n${template.advanced.name ? `${template.advanced.name} ` : ''}Template Configuration`));
				let advancedQuestions = [];
				template.advanced.variables.forEach((variable) => {
					if (variable.name && variable.type && variable.message) {
						// remove the value
						delete variable.value;
						advancedQuestions.push(variable);
					}
				});

				template.answers = await inquirer.prompt(advancedQuestions);
			}

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

			const templateVariables = {
				'snapfu.name': answers.name,
				'snapfu.siteId': answers.siteId,
				'snapfu.author': user.name,
				'snapfu.framework': answers.framework,
			};

			// add advanced template variables
			if (template.answers) {
				Object.keys(template.answers).forEach((key) => {
					const value = template.answers[key];
					templateVariables[`snapfu.variables.${key}`] = value;
				});
			}

			try {
				console.log(`Cloning template into ${dir} via SSH...`);
				await cloneAndCopyRepo(template.ssh, dir, true, templateVariables);
				console.log(`${chalk.cyan(template.ssh)}\n`);
			} catch (err) {
				console.log(`SSH authentication failed. Cloning template into ${dir} via HTTPS...`);
				await cloneAndCopyRepo(template.http, dir, true, templateVariables);
				console.log(`${chalk.cyan(template.http)}\n`);
			}

			// waiting here due to copyPromise function resolving before template is actually copied
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

			// set tag and branch protection rules
			await setTagProtection(options, { organization: answers.organization, name: answers.name });
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

export const setTagProtection = async function (options, details) {
	const pattern = '*';
	const { user } = options;

	let octokit = new Octokit({
		auth: user.token,
	});

	const { organization, name } = details;

	if (!options.dev && organization && name) {
		console.log(`Setting tag protection for ${organization}/${name}...`);

		try {
			// create tag protection rule repository
			const tagProtectionResponse = await octokit.rest.repos.createTagProtection({
				owner: organization,
				repo: name,
				pattern,
			});

			if (tagProtectionResponse?.status === 201) {
				console.log(chalk.green(`created tag protection rule '${pattern}'`));
			} else {
				throw new Error('tag not created');
			}
		} catch (err) {
			console.log(chalk.red(`failed to set tag protection rule '${pattern}'`));
		}
	} else {
		console.log(chalk.yellow('skipping creation of tag protection'));
	}
	console.log(); // new line spacing
};

export const setBranchProtection = async function (options, details) {
	const { user } = options;

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
	const { user } = options;

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

export const cloneAndCopyRepo = async function (sourceRepo, destination, excludeGit, variables) {
	let folder = await fs.mkdtemp(path.join(os.tmpdir(), 'snapfu-temp')).then(async (folder, err) => {
		if (err) throw err;
		return folder;
	});

	// clone template repo into temp dir
	await commandOutput(`git clone ${sourceRepo} ${folder}`);

	let options = { clobber: true };

	if (excludeGit) {
		options.filter = (name) => {
			return !name.endsWith('/.git');
		};
	}

	if (variables) {
		options.transform = async (read, write, file) => {
			await transform(read, write, variables, file);
		};
	}

	// copy from temp dir to destination (with optional transforms)
	await copyPromise(folder, destination, options);
};

export const transform = function (read, write, variables, file) {
	if (
		file.name.endsWith('.md') ||
		file.name.endsWith('.html') ||
		file.name.endsWith('.json') ||
		file.name.endsWith('.yml') ||
		file.name.endsWith('.scss') ||
		file.name.endsWith('.sass') ||
		file.name.endsWith('.jsx') ||
		file.name.endsWith('.ts') ||
		file.name.endsWith('.tsx') ||
		file.name.endsWith('.js')
	) {
		// create and pipe through multiple replaceStreams
		let pipeline = read;
		Object.keys(variables).forEach(function (variable) {
			let value = variables[variable];
			let regex = new RegExp('{{\\s*' + variable + '\\s*}}', 'gi');
			pipeline = pipeline.pipe(replaceStream(regex, value));
		});

		pipeline.pipe(write);
		// write.write(content);
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
