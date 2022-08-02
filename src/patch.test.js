import { listPatches, getVersions, setupPatchRepo, editYAMLorJSON } from './patch.js';
import { cmp } from './utils/index.js';

import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import path from 'path';
import { promises as fsp } from 'fs';

const mockPackageJSON = {
	version: '0.0.1',
	searchspring: {
		siteId: 'ga9kq2',
		framework: 'preact',
		platform: 'bigcommerce',
		tags: ['finder'],
	},
};

const mockPatches = {
	preact: ['0.100.0', '0.100.1', '0.100.2b', '0.100.2', '0.100.2a', '0.101.0', '0.102.0'],
	react: ['0.0.1', '0.0.2', '0.0.3', '0.0.4', '0.1.0', '0.1.1'],
};

let homeDir = '';
let searchspringDir = '';
let mockPatchesDir = '';
let projectDirRoot = '';
let projectDir = '';
let projectDirDeep = '';
let packagePath = '';

beforeAll(async () => {
	// setup project
	homeDir = path.join(tempDirectory, Math.random() + '');
	searchspringDir = path.join(homeDir, '.searchspring');
	mockPatchesDir = path.join(searchspringDir, 'snapfu-mock-patches');
	projectDirRoot = path.join(tempDirectory, Math.random() + '');
	projectDir = path.join(projectDirRoot, 'projects/secret.project');

	// create dirs
	fs.mkdirsSync(projectDir, true);
	fs.mkdirsSync(homeDir, true);
	fs.mkdirsSync(searchspringDir, true);
	fs.mkdirsSync(mockPatchesDir, true);

	// setup patches mocks
	Object.keys(mockPatches).forEach((framework) => {
		mockPatches[framework].forEach((version) => {
			fs.mkdirsSync(path.join(mockPatchesDir, framework, version), true);
		});
	});

	packagePath = path.join(projectDir, 'package.json');
});

beforeEach(async () => {
	await fsp.writeFile(packagePath, JSON.stringify(mockPackageJSON));
});

afterAll(() => {
	fs.emptyDirSync(projectDirRoot, (err) => {
		if (err) return console.error(err);
	});
	fs.emptyDirSync(homeDir, (err) => {
		if (err) return console.error(err);
	});
});

describe('setupPatchRepo function', () => {
	it('can setup patch repo', async () => {
		const options = {
			config: {
				searchspringDir: path.join(searchspringDir),
				patches: {
					dir: path.join(searchspringDir, 'snapfu-patches'),
					repoName: 'snapfu-patches',
					repoUrl: 'https://github.com/searchspring/snapfu-patches.git',
				},
			},
			context: {
				searchspring: {
					siteId: 'abc123',
					framework: 'preact',
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.0.1',
			},
			dev: false,
			command: 'patch',
			args: ['list'],
		};

		await setupPatchRepo(options);

		const directoryContents = fs.statSync(options.config.patches.dir);
		expect(directoryContents.isDirectory()).toBe(true);
	});
});

describe('getVersions function', () => {
	it('can get a list of available versions', async () => {
		const framework = 'preact';

		const options = {
			config: {
				searchspringDir: path.join(homeDir, '/.searchspring'),
				patches: {
					dir: mockPatchesDir,
					repoName: 'snapfu-patches',
					repoUrl: 'git@github.com:searchspring/snapfu-patches.git',
				},
			},
			context: {
				searchspring: {
					siteId: 'abc123',
					framework,
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.0.1',
			},
			dev: false,
			command: 'patch',
			args: ['list'],
		};

		const versions = await getVersions(options);
		const sortedMockVersions = mockPatches[framework].sort(cmp);

		expect(versions).toStrictEqual(sortedMockVersions);
	});

	it('can get a list of available versions using starting at', async () => {
		const framework = 'preact';

		const options = {
			config: {
				searchspringDir: path.join(homeDir, '/.searchspring'),
				patches: {
					dir: mockPatchesDir,
					repoName: 'snapfu-patches',
					repoUrl: 'git@github.com:searchspring/snapfu-patches.git',
				},
			},
			context: {
				searchspring: {
					siteId: 'abc123',
					framework,
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.100.2',
			},
			dev: false,
			command: 'patch',
			args: ['list'],
		};

		const versions = await getVersions(options, options.context.projectVersion);
		const sortedMockVersions = mockPatches[framework].sort(cmp);
		const startVersionIndex = mockPatches[framework].indexOf(options.context.projectVersion);
		const trimmedMockVersions = sortedMockVersions.slice(startVersionIndex + 1);
		expect(versions).toStrictEqual(trimmedMockVersions);
	});

	it('can get a list of available versions using ending at', async () => {
		const framework = 'preact';

		const options = {
			config: {
				searchspringDir: path.join(homeDir, '/.searchspring'),
				patches: {
					dir: mockPatchesDir,
					repoName: 'snapfu-patches',
					repoUrl: 'git@github.com:searchspring/snapfu-patches.git',
				},
			},
			context: {
				searchspring: {
					siteId: 'abc123',
					framework,
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.100.2',
			},
			dev: false,
			command: 'patch',
			args: ['list'],
		};

		const versions = await getVersions(options, undefined, options.context.projectVersion);
		const sortedMockVersions = mockPatches[framework].sort(cmp);
		const endVersionIndex = mockPatches[framework].indexOf(options.context.projectVersion);
		const trimmedMockVersions = sortedMockVersions.slice(0, endVersionIndex + 1);

		expect(versions).toStrictEqual(trimmedMockVersions);
	});

	it('can get a list of available versions using both starting & ending at', async () => {
		const framework = 'preact';

		const options = {
			config: {
				searchspringDir: path.join(homeDir, '/.searchspring'),
				patches: {
					dir: mockPatchesDir,
					repoName: 'snapfu-patches',
					repoUrl: 'git@github.com:searchspring/snapfu-patches.git',
				},
			},
			context: {
				searchspring: {
					siteId: 'abc123',
					framework,
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.100.2',
			},
			dev: false,
			command: 'patch',
			args: ['list'],
		};

		const endVersion = '0.101.0';
		const versions = await getVersions(options, options.context.projectVersion, endVersion);
		const sortedMockVersions = mockPatches[framework].sort(cmp);
		const startVersionIndex = mockPatches[framework].indexOf(options.context.projectVersion);
		const endVersionIndex = mockPatches[framework].indexOf(endVersion);
		const trimmedMockVersions = sortedMockVersions.slice(startVersionIndex + 1, endVersionIndex + 1);

		expect(versions).toStrictEqual(trimmedMockVersions);
	});
});

describe('editYAMLorJSON function', () => {
	it('can use update to add new key', async () => {
		const options = {
			context: {
				project: {
					path: projectDir,
				},
			},
		};

		const dependencies = {
			'@searchspring/snap-preact': '0.21.0',
			'@searchspring/snap-preact-components': '0.21.0',
		};

		const changes = [
			{
				update: {
					dependencies: dependencies,
				},
			},
		];

		await editYAMLorJSON(options, 'package.json', changes, 'json');

		const contents = await fsp.readFile(packagePath, 'utf8');
		const parsed = JSON.parse(contents);

		const expectedContents = { ...mockPackageJSON, dependencies };
		expect(parsed).toStrictEqual(expectedContents);
	});

	it('can use update to add deep nested keys', async () => {
		const options = {
			context: {
				project: {
					path: projectDir,
				},
			},
		};

		const ocean = {
			deep: {
				fishes: ['tuna', 'swordfish'],
			},
		};

		const changes = [
			{
				update: {
					ocean: ocean,
				},
			},
		];

		await editYAMLorJSON(options, 'package.json', changes, 'json');

		const contents = await fsp.readFile(packagePath, 'utf8');
		const parsed = JSON.parse(contents);

		const expectedContents = { ...mockPackageJSON, ocean };
		expect(parsed).toStrictEqual(expectedContents);

		const changes2 = [
			{
				update: {
					ocean: {
						deep: {
							deeper: {
								fishes: ['whale', 'sharks'],
							},
						},
					},
				},
			},
		];

		await editYAMLorJSON(options, 'package.json', changes2, 'json');

		const deeperContents = await fsp.readFile(packagePath, 'utf8');
		const deeperParsed = JSON.parse(deeperContents);

		const expectedDeeperContents = {
			...mockPackageJSON,
			ocean: {
				deep: {
					fishes: ['tuna', 'swordfish'],
					deeper: {
						fishes: ['whale', 'sharks'],
					},
				},
			},
		};
		expect(deeperParsed).toStrictEqual(expectedDeeperContents);
	});

	it('can use update to alter existing keys', async () => {
		const options = {
			context: {
				project: {
					path: projectDir,
				},
			},
		};

		const version = '0.33.0';

		const changes = [
			{
				update: {
					version,
				},
			},
		];

		await editYAMLorJSON(options, 'package.json', changes, 'json');

		const contents = await fsp.readFile(packagePath, 'utf8');
		const parsed = JSON.parse(contents);

		const expectedContents = { ...mockPackageJSON, version };
		expect(parsed).toStrictEqual(expectedContents);
	});
});

// describe('edit JSON', () => {
// 	it('can update key values', async () => {
// 		// TODO
// 	});
// });
