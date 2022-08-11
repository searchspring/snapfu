import { listPatches, applyPatches, getVersions, setupPatchRepo, editYAMLorJSON } from './patch.js';
import { cmp } from './utils/index.js';

import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import path from 'path';
import { promises as fsp } from 'fs';
import YAML from 'yaml';

const mockPackage = {
	version: '0.0.1',
	searchspring: {
		siteId: 'ga9kq2',
		framework: 'preact',
		platform: 'bigcommerce',
		tags: ['finder', 'ac', 'email'],
		nestedObject: {
			hello: 'world',

			deep: {
				search: 'spring',
				helloo: 'woorld',
			},
		},
	},
};

const mockPatch = {
	version: 'x.x.x',
	description: 'a mock patch',
	steps: [
		{
			run: 'echo "patching..."',
		},
		{
			files: {
				'package.json': {
					action: 'edit',
					changes: [
						{
							update: {
								searchspring: {
									tags: ['patched'],
								},
							},
						},
					],
				},
			},
		},
	],
};

const mockPatches = {
	preact: ['0.100.0', '0.100.1', '0.100.2-2', '0.100.2', '0.100.2-1', '0.101.0', '0.102.0'],
	react: ['0.1.0', '0.1.2', '0.1.3', '0.1.4', '0.1.5', '0.2.0'],
};

let homeDir = '';
let searchspringDir = '';
let mockPatchesDir = '';
let projectDirRoot = '';
let projectDir = '';
let projectDirDeep = '';
let packageJSONPath = '';
let packageYAMLPath = '';

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

	packageJSONPath = path.join(projectDir, 'package.json');
	packageYAMLPath = path.join(projectDir, 'package.yaml');

	// setup patches mocks
	for (const framework of Object.keys(mockPatches)) {
		for (const version of mockPatches[framework]) {
			const patchDirPath = path.join(mockPatchesDir, framework, version);
			fs.mkdirsSync(patchDirPath, true);

			// create mock patch file for each patch version
			const patchPath = path.join(patchDirPath, `patch.${framework}.${version}.yaml`);
			const patchContents = JSON.parse(JSON.stringify(mockPatch));
			patchContents.version = version;
			await fsp.writeFile(patchPath, YAML.stringify(patchContents));
		}
	}
});

beforeEach(async () => {
	await fsp.writeFile(packageJSONPath, JSON.stringify(mockPackage));
	await fsp.writeFile(packageYAMLPath, YAML.stringify(mockPackage));
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

describe('listPatches', () => {
	it('can list patches', async () => {
		const logHistory = [];
		const consoleMock = jest.spyOn(global.console, 'log').mockImplementation((...args) => {
			logHistory.push(args[0]);
		});

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
					framework: 'preact',
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.0.1',
			},
			options: {
				ci: true,
			},
			dev: false,
			command: 'patch',
			args: ['list'],
		};

		await listPatches(options, true);

		console.warn('history', logHistory);
		mockPatches.preact.forEach((version) => {
			expect(logHistory.includes(version)).toBe(true);
		});

		consoleMock.mockRestore();
	});
});

describe('applyPatches', () => {
	it('can apply a single patch', async () => {
		const logHistory = [];
		const consoleMock = jest.spyOn(global.console, 'log').mockImplementation((...args) => {
			logHistory.push(args[0]);
		});

		const version = '0.100.0';

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
					framework: 'preact',
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.0.1',
			},
			options: {
				ci: true,
			},
			dev: false,
			command: 'patch',
			args: ['apply', version],
		};

		await applyPatches(options, true);

		const contents = await fsp.readFile(packageJSONPath, 'utf8');
		const parsed = JSON.parse(contents);
		expect(parsed.searchspring.tags).toStrictEqual([...mockPackage.searchspring.tags, 'patched']);
		expect(parsed.version).toBe(version);
		expect(logHistory.includes('patching...\n')).toBe(true);

		consoleMock.mockRestore();
	});

	it('can apply patches to latest', async () => {
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
					framework: 'preact',
				},
				project: {
					// version: '0.0.1',
					path: projectDir,
				},
				projectVersion: '0.0.1',
			},
			options: {
				ci: true,
			},
			dev: false,
			command: 'patch',
			args: ['apply', 'latest'],
		};

		await applyPatches(options, true);
		const contents = await fsp.readFile(packageJSONPath, 'utf8');
		const parsed = JSON.parse(contents);

		expect(parsed.searchspring.tags).toStrictEqual([...mockPackage.searchspring.tags, ...mockPatches.preact.map((p) => 'patched')]);
		expect(parsed.version).toBe(mockPatches.preact[mockPatches.preact.length - 1]);
	});
});

describe('editYAMLorJSON function', () => {
	['json', 'yaml'].forEach((type) => {
		describe(type, () => {
			let packagePath;
			let parser;
			let packageName;

			beforeAll(() => {
				if (type == 'json') {
					packagePath = packageJSONPath;
					parser = JSON;
				} else {
					packagePath = packageYAMLPath;
					parser = YAML;
				}

				// filename without path needed in function
				packageName = path.basename(packagePath);
			});

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

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');

				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage, dependencies };

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
						fishes: 'tuna swordfish',
					},
				};

				const changes = [
					{
						update: {
							ocean: ocean,
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage, ocean };
				expect(parsed).toStrictEqual(expectedContents);

				const changes2 = [
					{
						update: {
							ocean: {
								deep: {
									deeper: {
										fishes: 'whale sharks',
									},
								},
							},
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes2);

				const deeperContents = await fsp.readFile(packagePath, 'utf8');
				const deeperParsed = parser.parse(deeperContents);

				const expectedDeeperContents = {
					...mockPackage,
					ocean: {
						deep: {
							fishes: 'tuna swordfish',
							deeper: {
								fishes: 'whale sharks',
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

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage, version };
				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can append to an existing array', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						update: {
							searchspring: {
								tags: ['newItem', 'newer', 'newest'],
							},
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = parser.parse(JSON.stringify(mockPackage));
				(expectedContents.searchspring.tags = expectedContents.searchspring.tags.concat(['newItem', 'newer', 'newest'])),
					expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove keys', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: {
							searchspring: ['siteId'],
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage };
				delete expectedContents.searchspring.siteId;
				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove multiple keys', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: {
							searchspring: ['siteId', 'framework'],
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage };
				delete expectedContents.searchspring.siteId;
				delete expectedContents.searchspring.framework;

				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove array entries', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: {
							searchspring: {
								tags: ['finder', 'ac'],
							},
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage };
				expectedContents.searchspring.tags = ['email'];

				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove root level keys', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: ['version'],
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage };
				delete expectedContents.version;
				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove multiple root level keys', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: ['version', 'searchspring'],
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage };
				delete expectedContents.version;
				delete expectedContents.searchspring;
				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove nested keys', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: {
							searchspring: {
								nestedObject: ['hello'],
							},
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = {
					...mockPackage,
				};
				delete expectedContents.searchspring.nestedObject.hello;
				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove to remove deep nested keys', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: {
							searchspring: {
								nestedObject: {
									deep: ['helloo'],
								},
							},
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = {
					...mockPackage,
				};
				delete expectedContents.searchspring.nestedObject.deep.helloo;
				expect(parsed).toStrictEqual(expectedContents);
			});

			it('can use remove when key does not exist', async () => {
				const options = {
					context: {
						project: {
							path: projectDir,
						},
					},
				};

				const changes = [
					{
						remove: {
							searchspring: ['doesnotexist'],
						},
					},
				];

				await editYAMLorJSON(options, packageName, changes);

				const contents = await fsp.readFile(packagePath, 'utf8');
				const parsed = parser.parse(contents);

				const expectedContents = { ...mockPackage };

				expect(parsed).toStrictEqual(expectedContents);
			});
		});
	});
});
