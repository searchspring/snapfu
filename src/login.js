import { escape } from 'querystring';
import open from 'open';
import http from 'http';
import { parse } from 'url';
import { promises as fsp } from 'fs';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import os from 'os';

export const login = async (options, opener, port) => {
	let uri = github.createOauthUrl({ isDev: options.dev });
	let receivedUrl = auth.listenForCallback(port | 3827);

	if (!opener) {
		open(uri, { wait: true });
	} else {
		opener(uri);
	}

	const value = await receivedUrl;
	return auth.saveCredsFromUrl(value, options.config.searchspringDir);
};

export const logout = async (options) => {
	return auth.removeCreds(options.config.searchspringDir);
};

export const orgAccess = async (options, opener) => {
	let uri = github.createOrgAccessUrl({ isDev: options.dev });

	if (!opener) {
		open(uri);
	} else {
		opener(uri);
	}
};

export const github = {
	scopes: 'user:email,repo',
	createOauthUrl: (config) => {
		let clientId = config.isDev ? 'e02c8965ff92aa84b6ee' : '5df635731e7fa3513c1d';
		let redirectUrl = config.isDev ? 'http://localhost:3000' : 'https://token.kube.searchspring.io';
		return `https://github.com/login/oauth/authorize?response_type=token&scope=${escape(github.scopes)}&client_id=${clientId}&redirect_uri=${escape(
			redirectUrl
		)}`;
	},
	createOrgAccessUrl: (config) => {
		let clientId = config.isDev ? 'e02c8965ff92aa84b6ee' : '5df635731e7fa3513c1d';
		return `https://github.com/settings/connections/applications/${clientId}`;
	},
};

export const auth = {
	saveCredsFromUrl: async (url, dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		const query = parse(url, true).query;
		if (query && query.user) {
			try {
				let user = JSON.parse(query.user);
				try {
					const creds = await auth.loadCreds(dir);
					user.keys = creds.keys || {}; // preserve any exisiting keys
				} catch (e) {
					// do nothing when login is invoked for the first time and creds.json doesn't exist
					if (e != 'creds not found') {
						console.log(chalk.red(e));
					}
				}
				await fsp.writeFile(path.join(dir, '/creds.json'), JSON.stringify(user));
				return user;
			} catch (e) {
				console.log(chalk.red(e.message, query.user));
			}
		}
	},
	saveSecretKey: async (secretKey, siteId, dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		const creds = await auth.loadCreds(dir);
		if (creds && secretKey && siteId) {
			creds.keys = creds.keys || {};
			creds.keys[siteId] = secretKey;
			try {
				await fsp.writeFile(path.join(dir, '/creds.json'), JSON.stringify(creds));
				return {
					siteId,
					secretKey,
				};
			} catch (e) {
				console.log(chalk.red(e.message));
			}
		}
	},
	removeCreds: async (dir) => {
		const creds = await auth.loadCreds(dir);
		if (creds) {
			const credsLocation = path.join(dir, '/creds.json');
			const newCreds = { keys: creds.keys };
			await fsp.writeFile(credsLocation, JSON.stringify(newCreds));
		}
	},
	loadCreds: async (dir) => {
		return new Promise((resolve, reject) => {
			let credsLocation = path.join(dir, '/creds.json');
			if (!fs.existsSync(credsLocation)) {
				fs.writeFileSync(credsLocation, JSON.stringify({ keys: {} }));
			}
			let creds = fs.readFileSync(credsLocation, 'utf8');
			if (!creds) {
				reject('creds not found');
			}

			try {
				const user = JSON.parse(creds);
				user.keys = user.keys || {};
				resolve(user);
			} catch (err) {
				reject('creds are invalid');
			}
		});
	},
	loadSettings: async (dir) => {
		return new Promise((resolve, reject) => {
			let settingsLocation = path.join(dir, '/snapfu.json');
			if (!fs.existsSync(settingsLocation)) {
				resolve({});
			}
			let settingsContents = fs.readFileSync(settingsLocation, 'utf8');
			if (!settingsContents) {
				reject('settings are invalid');
			}

			try {
				const settings = JSON.parse(settingsContents);
				resolve(settings);
			} catch (err) {
				reject('settings are invalid');
			}
		});
	},
	loadUser: async (dir) => {
		let user;

		try {
			user = await auth.loadCreds(dir);
		} catch (err) {
			console.error(err);
			user = { keys: {} };
		}

		try {
			user.settings = await auth.loadSettings(dir);
		} catch (err) {
			// invalid settings - ignoring
		}

		return user;
	},
	listenForCallback: (port) => {
		return new Promise((resolutionFunc, rejectionFunc) => {
			let server = http.createServer(function (req, res) {
				let url = req.url;
				res.end(`<html><body>You may close this window now.<script>javascript:window.close('','_parent','')</script></body></html>`);
				server.close();
				resolutionFunc(url);
			});
			(async function () {
				server.listen(port);
			})();
		});
	},
};
