import os from 'os';
import { exit, cwd } from 'process';
import { readdirSync, readFileSync, existsSync, mkdirSync, promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import inquirer from 'inquirer';
import clone from 'git-clone';
import sodium from 'tweetsodium';
import { ncp } from 'ncp';
import { auth } from './login';
import { ConfigApi } from './services/ConfigApi';

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

		if (!user) {
			console.log(chalk.red(`No creds file found, please use snapfu login`));
			exit(1);
		}

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

		let questions = [
			{
				type: 'input',
				name: 'name',
				validate: (input) => {
					return input && input.length > 0;
				},
				message: 'Please choose the name of this repository',
				default: path.basename(dir),
			},
			{
				type: 'list',
				name: 'framework',
				message: "Please choose the framework you'd like to use",
				choices: ['preact'],
				default: 'preact',
			},
			{
				type: 'list',
				name: 'organization',
				message: 'Please choose which github organization to create this repository in',
				choices: orgs,
				default: 'searchspring-implementations',
			},
			{
				type: 'input',
				name: 'siteId',
				message: 'Please enter the siteId as found in the SMC console (a1b2c3)',
				validate: (input) => {
					return input && input.length > 0 && /^[0-9a-z]{6}$/.test(input);
				},
			},
			{
				type: 'input',
				name: 'secretKey',
				message: 'Please enter the secretKey as found in the SMC console (32 characters)',
				validate: (input) => {
					return input && input.length > 0 && /^[0-9a-zA-Z]{32}$/.test(input);
				},
			},
		];

		const answers = await inquirer.prompt(questions);
		console.log();

		try {
			await new ConfigApi(answers.secretKey, options.dev).validateSite(answers.siteId);
		} catch (err) {
			console.log(chalk.red('Verification of siteId and secretKey failed.'));
			console.log(chalk.red(err));
			exit(1);
		}

		// create local directory
		let folderName = await createDir(dir);

		if (options.dev) {
			console.log(chalk.blueBright('Skipping new repo creation...'));
		} else {
			// create the remote repo
			console.log(`Creating repository...`);

			await octokit.repos
				.createInOrg({
					org: answers.organization,
					name: answers.name,
					private: true,
					auto_init: true,
				})
				.then(() => console.log(`${chalk.greenBright(answers.name)}\n`))
				.catch((err) => {
					if (!err.message.includes('already exists')) {
						console.log(chalk.red(err.message));
						exit(1);
					} else {
						console.log(chalk.yellow('repository already exists\n'));
					}
				});
		}

		// newly create repo URLs
		const repoUrlSSH = `git@github.com:${answers.organization}/${answers.name}.git`;
		const repoUrlHTTP = `https://github.com/${answers.organization}/${answers.name}`;

		// template repo URLs
		const templateUrlSSH = `git@github.com:searchspring/snapfu-template-${answers.framework}.git`;
		const templateUrlHTTP = `https://github.com/searchspring/snapfu-template-${answers.framework}`;

		if (!options.dev) {
			console.log(`Cloning repository...`);
			try {
				await cloneAndCopyRepo(repoUrlSSH, dir, false);
				console.log(`${chalk.greenBright(repoUrlSSH)}\n`);
			} catch (err) {
				await cloneAndCopyRepo(repoUrlHTTP, dir, false);
				console.log(`${chalk.greenBright(repoUrlHTTP)}\n`);
			}
		}

		console.log(`Cloning template into ${dir}...`);
		try {
			await cloneAndCopyRepo(templateUrlSSH, dir, true, {
				'snapfu.name': answers.name,
				'snapfu.siteId': answers.siteId,
				'snapfu.author': user.name,
				'snapfu.framework': answers.framework,
			});
			console.log(`${chalk.greenBright(templateUrlSSH)}\n`);
		} catch (err) {
			await cloneAndCopyRepo(templateUrlHTTP, dir, true, {
				'snapfu.name': answers.name,
				'snapfu.siteId': answers.siteId,
				'snapfu.author': user.name,
				'snapfu.framework': answers.framework,
			});
			console.log(`${chalk.greenBright(templateUrlHTTP)}\n`);
		}

		// save secretKey mapping to creds.json
		const { siteId, secretKey } = await auth.saveSecretKey(answers.secretKey, answers.siteId);

		await setRepoSecret(options, { siteId: answers.siteId, secretKey: answers.secretKey, organization: answers.organization, name: answers.name });
		console.log();

		if (dir != cwd()) {
			console.log(
				`The ${chalk.blue(folderName)} directory has been created and initialized from ${chalk.blue(`snapfu-template-${answers.framework}`)}.`
			);
			console.log(`Get started by installing package dependencies:`);
			console.log(chalk.grey(`\n\tcd ${folderName} && npm install\n`));
		} else {
			console.log(`Current working directory has been initialized from ${chalk.blue(`snapfu-template-${answers.framework}`)}.`);
			console.log(`Get started by installing package dependencies:`);
			console.log(chalk.grey(`\n\tnpm install\n`));
		}
	} catch (err) {
		console.log(chalk.red(err));
		exit(1);
	}
};

export const setRepoSecret = async function (options, details) {
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
			const secret_name = 'WEBSITE_SECRET_KEY';

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
};

export const cloneAndCopyRepo = async function (sourceRepo, destination, excludeGit, transforms) {
	let folder = await fs.mkdtemp(path.join(os.tmpdir(), 'snapfu-temp')).then(async (folder, err) => {
		if (err) throw err;
		return folder;
	});

	await clonePromise(sourceRepo, folder);
	let options = { clobber: false };

	if (excludeGit) {
		options.filter = (name) => {
			return !name.endsWith('/.git');
		};
	}

	if (transforms) {
		options.transform = async (read, write, file) => {
			transform(read, write, transforms, file);
		};
	}

	await copyPromise(folder, destination, options);
};

export const transform = async function (read, write, transforms, file) {
	if (file.name.endsWith('.json') || file.name.endsWith('.yml')) {
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
	return new Promise(async (resolutionFunc, rejectionFunc) => {
		clone(repoUrl, destination, (err) => {
			if (err) {
				rejectionFunc(err);
			}
			resolutionFunc();
		});
	});
}

function copyPromise(source, destination, options) {
	return new Promise(async (resolutionFunc, rejectionFunc) => {
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
