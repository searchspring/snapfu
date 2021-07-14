import { getClosest, getPackageJSON, getContext, commandOutput } from './template';
import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import path from 'path';
import { promises as fsp } from 'fs';

const mockPackageJSON = {
	searchspring: {
		siteId: 'ga9kq2',
		framework: 'preact',
		platform: 'bigcommerce',
		tags: ['finder'],
	},
};

const mockCreds = { login: 'mylogin', name: 'myname', token: 'xyz' };

let homeDir = '';
let projectDirRoot = '';
let projectDir = '';
let projectDirDeep = '';
let packagePath = '';

beforeEach(async () => {
	// setup creds
	homeDir = path.join(tempDirectory, Math.random() + '');
	fs.mkdirsSync(path.join(homeDir, '.searchspring'));
	await fsp.writeFile(path.join(homeDir, '.searchspring/creds.json'), JSON.stringify(mockCreds));

	// setup project
	projectDirRoot = path.join(tempDirectory, Math.random() + '');
	projectDir = path.join(projectDirRoot, 'workbox/projects/Snapps/secret.project');
	projectDirDeep = path.join(projectDir, 'src/components/Recommendations');

	fs.mkdirsSync(projectDir, true);
	fs.mkdirsSync(projectDirDeep, true);

	packagePath = path.join(projectDir, 'package.json');
	await fsp.writeFile(packagePath, JSON.stringify(mockPackageJSON));
});

afterEach(() => {
	fs.emptyDirSync(homeDir, (err) => {
		if (err) return console.error(err);
	});

	fs.emptyDirSync(projectDirRoot, (err) => {
		if (err) return console.error(err);
	});
});

describe('getClosest function', () => {
	it('throws when it fails to find files', async () => {
		expect(() => {
			getClosest(projectRootDir, 'package.json');
		}).toThrow();
	});
});