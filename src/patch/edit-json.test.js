import path from 'path';
import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import { promises as fsp } from 'fs';

import { editJSON } from './edit-json.js';

// Example YAML Patch File Contents
/*
	steps:
		- files:
			package.json:
				action: edit-json
				changes:
					- update:
						properties:
							dependencies:
								"@searchspring/snap-preact": "0.21.0"
								"@searchspring/snap-preact-components": "0.21.0"
*/

const mockPackage = {
	version: '1.2.3',
	searchspring: {
		version: '0.0.1',
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
		arrayOfObjects: [
			{
				order: 'first',
			},
			{
				order: 'second',
			},
			{
				order: 'third',
			},
		],
	},
	dependencies: {
		preact: '^10.6.4',
		mobx: '^6.3.12',
	},
	devDependencies: {
		webpack: '^5.65.0',
		sass: '^1.46.0',
	},
	array: [1, 2],
};

const getMockPackage = () => JSON.parse(JSON.stringify(mockPackage));

let projectDirRoot = '';
let projectDir = '';
let packagePath = '';
let packageName = '';

let options;

beforeAll(async () => {
	// setup project
	projectDirRoot = path.join(tempDirectory, Math.random() + '');
	projectDir = path.join(projectDirRoot, 'projects/secret.project');

	// create directoriess
	fs.mkdirsSync(projectDir, true);

	// mock package.json
	packagePath = path.join(projectDir, 'package.json');
	packageName = path.basename(packagePath);

	// mock bad.json
	const badJSONPath = path.join(projectDir, 'bad.json');
	const badJSONContents = `{ 'yup': 'its bad',}`;
	await fsp.writeFile(badJSONPath, badJSONContents);

	options = {
		context: {
			project: {
				path: projectDir,
			},
		},
	};
});

beforeEach(async () => {
	await fsp.writeFile(packagePath, JSON.stringify(mockPackage));
});

describe('editJSON function', () => {
	it(`doesn't do anything when there are no changes or no filename`, async () => {
		await editJSON(options, '', {});
	});

	it(`doesn't do anything when it does not find a file to edit`, async () => {
		const changes = [
			{
				update: {
					properties: {
						nope: 'sorry',
					},
				},
			},
		];

		await editJSON(options, 'file.dne', changes);
	});

	it(`throws an error when it attempts to parse JSON but fails`, async () => {
		const changes = [
			{
				update: {
					properties: {
						nope: 'sorry',
					},
				},
			},
		];

		try {
			await editJSON(options, 'bad.json', changes);
		} catch (e) {
			expect(e).toMatch('editJSON unable to parse bad.json');
		}
	});

	it(`preserves contents when no changes are specified`, async () => {
		const changes = [{}];

		await editJSON(options, packageName, changes);

		const contents = await fsp.readFile(packagePath, 'utf8');
		const parsed = JSON.parse(contents);

		// ensure unparsed file is equal
		expect(JSON.stringify(mockPackage)).toStrictEqual(contents);

		// ensure parsed data is equal
		expect(parsed).toStrictEqual(getMockPackage());
	});

	describe('using `properties`', () => {
		it('can use `update` to add a new key', async () => {
			const newKey = 'newValue';
			const changes = [
				{
					update: {
						properties: {
							newKey,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');

			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), newKey };

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to add multiple new keys', async () => {
			const newKey1 = 'newValue1';
			const newKey2 = 'newValue2';

			const changes = [
				{
					update: {
						properties: {
							newKey1,
							newKey2,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');

			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), newKey1, newKey2 };

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to update multiple existing keys', async () => {
			const ultrapack = '^7.7.7';
			const verified = true;

			const changes = [
				{
					update: {
						properties: {
							searchspring: {
								verified,
							},
							dependencies: {
								ultrapack,
							},
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');

			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.searchspring.verified = verified;
			expectedContents.dependencies.ultrapack = ultrapack;

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to add deep nested keys', async () => {
			const ocean = {
				deep: {
					fishes: 'swordfish',
				},
			};

			const changes = [
				{
					update: {
						properties: {
							ocean: ocean,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), ocean };
			expect(parsed).toStrictEqual(expectedContents);

			const changes2 = [
				{
					update: {
						properties: {
							ocean: {
								deep: {
									deeper: {
										fishes: 'whale sharks',
									},
								},
							},
						},
					},
				},
			];

			await editJSON(options, packageName, changes2);

			const deeperContents = await fsp.readFile(packagePath, 'utf8');
			const deeperParsed = JSON.parse(deeperContents);

			const expectedDeeperContents = {
				...getMockPackage(),
				ocean: {
					deep: {
						fishes: 'swordfish',
						deeper: {
							fishes: 'whale sharks',
						},
					},
				},
			};
			expect(deeperParsed).toStrictEqual(expectedDeeperContents);
		});

		it('can use `update` to add new properties to existing keys', async () => {
			const dependencies = {
				'@searchspring/snap-preact': '0.21.0',
				'@searchspring/snap-preact-components': '0.21.0',
			};

			const changes = [
				{
					update: {
						properties: {
							dependencies: dependencies,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');

			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.dependencies = { ...expectedContents.dependencies, ...dependencies };

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to alter existing keys', async () => {
			const version = '0.33.0';

			const changes = [
				{
					update: {
						properties: {
							version,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), version };
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to a top level existing array', async () => {
			const newEntries = [3, 4];

			const changes = [
				{
					update: {
						properties: {
							array: newEntries,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.array = expectedContents.array.concat(newEntries);
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing array', async () => {
			const newTags = ['newItem', 'newer', 'newest'];

			const changes = [
				{
					update: {
						properties: {
							searchspring: {
								tags: newTags,
							},
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			(expectedContents.searchspring.tags = expectedContents.searchspring.tags.concat(newTags)), expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing array and modify an existing key and add a new key', async () => {
			const newTags = ['newItem', 'newer', 'newest'];
			const verified = true;
			const topLevel = {
				this: {
					new: {
						thing: ['is', 'here'],
					},
				},
			};

			const changes = [
				{
					update: {
						properties: {
							searchspring: {
								tags: newTags,
								verified,
							},
							topLevel,
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.searchspring.tags = expectedContents.searchspring.tags.concat(newTags);
			expectedContents.searchspring.verified = verified;
			expectedContents.topLevel = topLevel;

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete key', async () => {
			const changes = [
				{
					remove: {
						properties: {
							searchspring: ['siteId'],
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.searchspring.siteId;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete multiple keys', async () => {
			const changes = [
				{
					remove: {
						properties: {
							searchspring: ['siteId', 'framework'],
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.searchspring.siteId;
			delete expectedContents.searchspring.framework;

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove array entries at the root level', async () => {
			const changes = [
				{
					remove: {
						properties: {
							array: [1, 2],
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			expectedContents.array = [];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove array entries', async () => {
			const changes = [
				{
					remove: {
						properties: {
							searchspring: {
								tags: ['finder', 'ac'],
							},
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			expectedContents.searchspring.tags = ['email'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove root level key', async () => {
			const changes = [
				{
					remove: {
						properties: ['version'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.version;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove multiple root level keys', async () => {
			const changes = [
				{
					remove: {
						properties: ['version', 'searchspring'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.version;
			delete expectedContents.searchspring;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove nested keys', async () => {
			const changes = [
				{
					remove: {
						properties: {
							searchspring: {
								nestedObject: ['hello'],
							},
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = {
				...getMockPackage(),
			};
			delete expectedContents.searchspring.nestedObject.hello;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove deep nested keys', async () => {
			const changes = [
				{
					remove: {
						properties: {
							searchspring: {
								nestedObject: {
									deep: ['helloo'],
								},
							},
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = {
				...getMockPackage(),
			};
			delete expectedContents.searchspring.nestedObject.deep.helloo;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` when key does not exist', async () => {
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
						properties: {
							searchspring: ['doesnotexist'],
						},
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };

			expect(parsed).toStrictEqual(expectedContents);
		});
	});

	describe('using `path`', () => {
		it('can use `update` to add new keys', async () => {
			const dependencies = {
				'@searchspring/snap-preact': '0.21.0',
				'@searchspring/snap-preact-components': '0.21.0',
			};

			const changes = [
				{
					update: {
						path: ['dependencies', '@searchspring/snap-preact'],
						value: '0.21.0',
					},
				},
				{
					update: {
						path: ['dependencies', '@searchspring/snap-preact-components'],
						value: '0.21.0',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');

			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.dependencies = { ...expectedContents.dependencies, ...dependencies };

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to add deep nested keys', async () => {
			const ocean = {
				deep: {
					fishes: 'swordfish',
				},
			};

			const changes = [
				{
					update: {
						path: ['ocean', 'deep', 'fishes'],
						value: 'swordfish',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), ocean };
			expect(parsed).toStrictEqual(expectedContents);

			const changes2 = [
				{
					update: {
						path: ['ocean', 'deep', 'deeper', 'fishes'],
						value: 'whale sharks',
					},
				},
			];

			await editJSON(options, packageName, changes2);

			const deeperContents = await fsp.readFile(packagePath, 'utf8');
			const deeperParsed = JSON.parse(deeperContents);

			const expectedDeeperContents = {
				...getMockPackage(),
				ocean: {
					deep: {
						fishes: 'swordfish',
						deeper: {
							fishes: 'whale sharks',
						},
					},
				},
			};
			expect(deeperParsed).toStrictEqual(expectedDeeperContents);
		});

		it('can use `update` to alter existing keys', async () => {
			const version = '0.33.0';

			const changes = [
				{
					update: {
						path: ['version'],
						value: version,
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), version };
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to replace existing key values', async () => {
			const dependencies = {
				'@searchspring/snap-preact': '0.21.0',
				'@searchspring/snap-preact-components': '0.21.0',
			};

			const changes = [
				{
					update: {
						path: ['dependencies'],
						value: dependencies,
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage(), dependencies };
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing string', async () => {
			const addition = ' (v10)';

			const changes = [
				{
					update: {
						path: ['searchspring', 'framework'],
						value: addition,
						modifier: 'append',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.searchspring.framework = expectedContents.searchspring.framework + addition;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to a top level existing array', async () => {
			const newEntries = [3, 4];

			const changes = [
				{
					update: {
						path: ['array'],
						modifier: 'append',
						values: newEntries,
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.array = expectedContents.array.concat(newEntries);
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to prepend to an existing string', async () => {
			const addition = 'new ';

			const changes = [
				{
					update: {
						path: ['searchspring', 'framework'],
						value: addition,
						modifier: 'prepend',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.searchspring.framework = addition + expectedContents.searchspring.framework;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing array with an array', async () => {
			const newTags = ['newItem', 'newer', 'newest'];

			const changes = [
				{
					update: {
						path: ['searchspring', 'tags'],
						value: newTags,
						modifier: 'append',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			(expectedContents.searchspring.tags = expectedContents.searchspring.tags.concat(newTags)), expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to prepend to an existing array with an array', async () => {
			const newTags = ['newItem', 'newer', 'newest'];

			const changes = [
				{
					update: {
						path: ['searchspring', 'tags'],
						value: newTags,
						modifier: 'prepend',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.searchspring.tags = newTags.concat(expectedContents.searchspring.tags);
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to select an array index within the path', async () => {
			const newPropValue = 'val';

			const changes = [
				{
					update: {
						path: ['searchspring', 'arrayOfObjects', 2, 'prop'],
						value: newPropValue,
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			expectedContents.searchspring.arrayOfObjects[2].prop = newPropValue;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete key', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'siteId'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.searchspring.siteId;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete multiple keys', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'siteId'],
					},
				},
				{
					remove: {
						path: ['searchspring', 'framework'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.searchspring.siteId;
			delete expectedContents.searchspring.framework;

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove a property within an array index', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'arrayOfObjects', 2, 'order'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = getMockPackage();
			delete expectedContents.searchspring.arrayOfObjects[2].order;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove an array entry', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'tags'],
						value: 'ac',
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			expectedContents.searchspring.tags = ['finder', 'email'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove an array at index', async () => {
			const indexPos = 1;
			const changes = [
				{
					remove: {
						path: ['searchspring', 'tags', indexPos],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			expectedContents.searchspring.tags.splice(indexPos, 1);

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove array entries', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'tags'],
						values: ['finder', 'ac'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			expectedContents.searchspring.tags = ['email'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove root level key', async () => {
			const changes = [
				{
					remove: {
						path: ['version'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.version;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove multiple root level keys', async () => {
			const changes = [
				{
					remove: {
						path: ['version'],
					},
				},
				{
					remove: {
						path: ['searchspring'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };
			delete expectedContents.version;
			delete expectedContents.searchspring;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove nested keys', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'nestedObject', 'hello'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = {
				...getMockPackage(),
			};
			delete expectedContents.searchspring.nestedObject.hello;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove deep nested keys', async () => {
			const changes = [
				{
					remove: {
						path: ['searchspring', 'nestedObject', 'deep', 'helloo'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = {
				...getMockPackage(),
			};
			delete expectedContents.searchspring.nestedObject.deep.helloo;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` when key does not exist', async () => {
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
						path: ['searchspring', 'doesnotexist'],
					},
				},
			];

			await editJSON(options, packageName, changes);

			const contents = await fsp.readFile(packagePath, 'utf8');
			const parsed = JSON.parse(contents);

			const expectedContents = { ...getMockPackage() };

			expect(parsed).toStrictEqual(expectedContents);
		});
	});
});
