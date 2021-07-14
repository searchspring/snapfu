import { getClosest, getPackageJSON, getContext, commandOutput } from './context';
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

	it('finds the nearest file', async () => {
		const closest = await getClosest(projectDir, 'package.json');
		expect(closest.length).toBe(1);
		expect(closest[0]).toBe(packagePath);
	});

	it('finds the nearest files by traversing up the file tree', async () => {
		const closest = await getClosest(projectDirDeep, 'package.json');
		expect(closest.length).toBe(1);
		expect(closest[0]).toBe(packagePath);
	});
});

describe('getPackageJSON function', () => {
	it('finds the nearest package.json file from process.cwd()', async () => {
		const packageJSON = getPackageJSON();
		expect(packageJSON).toBeDefined();
	});

	it('returns the parsed json file and adds a "project" attribute', async () => {
		const packageJSON = await getPackageJSON();
		expect(packageJSON.version).toBeDefined();
		expect(packageJSON.project).toBeDefined();
		expect(packageJSON.project).toHaveProperty('path');
		expect(packageJSON.project).toHaveProperty('dirname');
		expect(packageJSON.project.dirname).toBe('snapfu');
	});
});

describe('getContext function', () => {
	it('makes available context data', async () => {
		const context = await getContext();
		expect(context).toHaveProperty('user', 'project', 'repository', 'searchspring', 'version');
	});
});

describe('commandOutput function', () => {
	it('executes a command and returns the output', async () => {
		const hola = await commandOutput('echo "hello world"');
		expect(hola).toBe('hello world');
	});
});
