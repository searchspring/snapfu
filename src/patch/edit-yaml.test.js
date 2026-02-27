import YAML from 'yaml';
import path from 'path';
import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import { promises as fsp } from 'fs';

import { editYAML } from './edit-yaml.js';

// Example YAML Patch File Contents
/*
steps:
    - files:
        .github/workflows/deploy.yml:
            action: edit-yaml
            changes:
                - update:
                    path: ['jobs', 'publish' 'runs-on']
                    value: ${{ (startsWith(github.head_ref, 'update/') || startsWith(github.ref_name, 'update/') || startsWith(github.head_ref, 'revert/') || startsWith(github.ref_name, 'revert/') || (github.ref_name == github.event.repository.master_branch && (contains(github.event.head_commit.message,'from snap-implementations/update/') || contains(github.event.head_commit.message,'from snap-implementations/revert/')))) && 'self-hosted' || 'ubuntu-latest' }}
                    
                - update:
                    path: ['jobs', 'Publish', 'timeout-minutes']
                    value: 10

                - update:
                    path: ['jobs', 'Publish', 'steps | filter: "name", "Run @searchspring/snap-action"', 'with', 'secrets']
                    value: ${{ toJSON(secrets) }}
*/

const mockDeploy = `on: [ push, pull_request ]

jobs:
  Publish:
    runs-on: ubuntu-latest
    name: Snap Action
    things: [ 1, 2 ]
    steps:
      - name: Checkout action
        uses: actions/checkout@v2
        with:
          repository: searchspring/snap-action
      - name: Run @searchspring/snap-action
        uses: ./
        with:
          # required
          repository: \${{ env.GITHUB_REPOSITORY }}
          secretKey: \${{ secrets.WEBSITE_SECRET_KEY }}
          secrets: \${{ toJSON(secrets) }}
          aws-access-key-id: \${{ secrets.SNAPFU_AWS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.SNAPFU_AWS_SECRET_ACCESS_KEY }}
          aws-cloudfront-distribution-id: \${{secrets.SNAPFU_AWS_DISTRIBUTION_ID}}
          aws-s3-bucket-name: \${{secrets.SNAPFU_AWS_BUCKET}}
          # optional
          NODE_AUTH_TOKEN: \${{ secrets.PACKAGE_TOKEN }}
          GITHUB_BOT_TOKEN: \${{ secrets.MACHINE_TOKEN }}
          LHCI_GITHUB_APP_TOKEN: \${{ secrets.LHCI_GITHUB_APP_TOKEN }}
          skipTests: true
          skipLighthouse: true
          skipPublish: true
          skipInvalidation: true
`;

const getMockDeploy = () => YAML.parse(mockDeploy);

let projectDirRoot = '';
let projectDir = '';
let deployPath = '';
let deployName = '';

let options;

beforeAll(async () => {
	// setup project
	projectDirRoot = path.join(tempDirectory, Math.random() + '');
	projectDir = path.join(projectDirRoot, 'projects/secret.project');

	// create directoriess
	fs.mkdirsSync(projectDir, true);

	// mock deploy.yml
	deployPath = path.join(projectDir, 'deploy.yml');
	deployName = path.basename(deployPath);

	// mock bad.json
	const badYAMLPath = path.join(projectDir, 'bad.yml');
	const badYAMLContents = `{ 'yup': 'its bad',}`;
	await fsp.writeFile(badYAMLPath, badYAMLContents);

	options = {
		context: {
			project: {
				path: projectDir,
			},
		},
	};
});

beforeEach(async () => {
	await fsp.writeFile(deployPath, mockDeploy, 'utf8');
});

describe('editYAML function', () => {
	it(`doesn't do anything when there are no changes or no filename`, async () => {
		await editYAML(options, '', {});
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

		await editYAML(options, 'file.dne', changes);
	});

	it(`throws an error when it attempts to parse YAML but fails`, async () => {
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
			await editYAML(options, 'bad.json', changes);
		} catch (e) {
			expect(e).toMatch('editYAML unable to parse bad.json');
		}
	});

	it(`preserves comments when no changes are specified`, async () => {
		const changes = [{}];

		await editYAML(options, deployName, changes);

		const contents = await fsp.readFile(deployPath, 'utf8');
		const parsed = YAML.parse(contents);

		// ensure unparsed file is equal
		expect(mockDeploy).toStrictEqual(contents);

		// ensure parsed data is equal
		expect(parsed).toStrictEqual(getMockDeploy());
	});

	describe('using `properties`', () => {
		it(`preserves comments when there are changes specified`, async () => {
			const changes = [
				{
					update: {
						properties: {
							derp: 'derpy',
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const undoChanges = [
				{
					remove: {
						properties: ['derp'],
					},
				},
			];

			await editYAML(options, deployName, undoChanges);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			// ensure unparsed file is equal
			expect(mockDeploy).toStrictEqual(contents);

			// ensure parsed data is equal
			expect(parsed).toStrictEqual(getMockDeploy());
		});

		it('can use `update` to add new keys', async () => {
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

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');

			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), dependencies };

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to add multiple new keys', async () => {
			const dependencies = {
				'@searchspring/snap-preact': '0.21.0',
				'@searchspring/snap-preact-components': '0.21.0',
			};

			const devDependencies = {
				'@searchspring/snapfu': '^1.0.18',
			};

			const changes = [
				{
					update: {
						properties: {
							dependencies,
							devDependencies,
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');

			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), dependencies, devDependencies };

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to update multiple existing keys', async () => {
			const newThings = ['one', 'two', 'three'];
			const verified = true;

			const changes = [
				{
					update: {
						properties: {
							jobs: {
								Publish: {
									verified,
									newThings,
								},
							},
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');

			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.verified = verified;
			expectedContents.jobs.Publish.newThings = newThings;

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

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), ocean };
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

			await editYAML(options, deployName, changes2);

			const deeperContents = await fsp.readFile(deployPath, 'utf8');
			const deeperParsed = YAML.parse(deeperContents);

			const expectedDeeperContents = {
				...getMockDeploy(),
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
						properties: {
							version,
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), version };
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing array', async () => {
			const newTrigger = ['comment', 'thing'];

			const changes = [
				{
					update: {
						properties: {
							on: newTrigger,
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.on = expectedContents.on.concat(newTrigger);
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to a deeply nested existing array', async () => {
			const newThings = [3, 4];

			const changes = [
				{
					update: {
						properties: {
							jobs: {
								Publish: {
									things: newThings,
								},
							},
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.things = expectedContents.jobs.Publish.things.concat(newThings);
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing array and modify an existing key and add a new key', async () => {
			const newThings = [3, 4];
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
							jobs: {
								Publish: {
									things: newThings,
									verified,
								},
							},
							topLevel,
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.things = expectedContents.jobs.Publish.things.concat(newThings);
			expectedContents.jobs.Publish.verified = verified;
			expectedContents.topLevel = topLevel;

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete key', async () => {
			const changes = [
				{
					remove: {
						properties: {
							jobs: {
								Publish: ['name'],
							},
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.jobs.Publish.name;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete multiple keys', async () => {
			const changes = [
				{
					remove: {
						properties: {
							jobs: {
								Publish: ['name', 'runs-on'],
							},
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.jobs.Publish.name;
			delete expectedContents.jobs.Publish['runs-on'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove array entries at the root level', async () => {
			const changes = [
				{
					remove: {
						properties: {
							on: ['pull_request'],
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			expectedContents.on = ['push'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove array entries', async () => {
			const changes = [
				{
					remove: {
						properties: {
							jobs: {
								Publish: {
									things: [1, 2],
								},
							},
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			expectedContents.jobs.Publish.things = [];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove root level key', async () => {
			const changes = [
				{
					remove: {
						properties: ['jobs'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.jobs;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove multiple root level keys', async () => {
			const changes = [
				{
					remove: {
						properties: ['jobs', 'on'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.on;
			delete expectedContents.jobs;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove nested keys', async () => {
			const changes = [
				{
					remove: {
						properties: {
							jobs: {
								Publish: ['things', 'name'],
							},
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = {
				...getMockDeploy(),
			};
			delete expectedContents.jobs.Publish.things;
			delete expectedContents.jobs.Publish.name;
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
							jobs: ['doesnotexist'],
						},
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };

			expect(parsed).toStrictEqual(expectedContents);
		});
	});

	describe('using `path`', () => {
		it(`preserves comments when there are changes specified`, async () => {
			const changes = [
				{
					update: {
						path: ['derp'],
						value: 'derpy',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const undoChanges = [
				{
					remove: {
						path: ['derp'],
					},
				},
			];

			await editYAML(options, deployName, undoChanges);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			// ensure unparsed file is equal
			expect(mockDeploy).toStrictEqual(contents);

			// ensure parsed data is equal
			expect(parsed).toStrictEqual(getMockDeploy());
		});

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

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');

			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), dependencies };

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

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), ocean };
			expect(parsed).toStrictEqual(expectedContents);

			const changes2 = [
				{
					update: {
						path: ['ocean', 'deep', 'deeper', 'fishes'],
						value: 'whale sharks',
					},
				},
			];

			await editYAML(options, deployName, changes2);

			const deeperContents = await fsp.readFile(deployPath, 'utf8');
			const deeperParsed = YAML.parse(deeperContents);

			const expectedDeeperContents = {
				...getMockDeploy(),
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

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy(), version };
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing string', async () => {
			const addition = ' with stuff';

			const changes = [
				{
					update: {
						path: ['jobs', 'Publish', 'name'],
						value: addition,
						modifier: 'append',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.name = expectedContents.jobs.Publish.name + addition;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to prepend to an existing string', async () => {
			const addition = 'new ';

			const changes = [
				{
					update: {
						path: ['jobs', 'Publish', 'name'],
						value: addition,
						modifier: 'prepend',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.name = addition + expectedContents.jobs.Publish.name;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an existing array with an array', async () => {
			const newTags = ['newItem', 'newer', 'newest'];

			const changes = [
				{
					update: {
						path: ['jobs', 'Publish', 'things'],
						value: newTags,
						modifier: 'append',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			((expectedContents.jobs.Publish.things = expectedContents.jobs.Publish.things.concat(newTags)), expect(parsed).toStrictEqual(expectedContents));
		});

		it('can use `update` to prepend to an existing array with an array', async () => {
			const newTags = ['newItem', 'newer', 'newest'];

			const changes = [
				{
					update: {
						path: ['jobs', 'Publish', 'things'],
						value: newTags,
						modifier: 'prepend',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.things = newTags.concat(expectedContents.jobs.Publish.things);
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `update` to append to an object to an existing array', async () => {
			const newStep = {
				name: 'New Step',
				uses: 'actions/fakeaction@v999',
				with: {
					option1: 'an option',
					arrayOfStuff: ['things', 'and', 'stuff'],
				},
			};

			const changes = [
				{
					update: {
						path: ['jobs', 'Publish', 'steps'],
						value: newStep,
						modifier: 'append',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			((expectedContents.jobs.Publish.steps = expectedContents.jobs.Publish.steps.concat(newStep)), expect(parsed).toStrictEqual(expectedContents));
		});

		it('can use `update` to select an array index within the path', async () => {
			const newPropValue = 'super secret';

			const changes = [
				{
					update: {
						path: ['jobs', 'Publish', 'steps', 1, 'secrets'],
						value: newPropValue,
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = getMockDeploy();
			expectedContents.jobs.Publish.steps[1].secrets = newPropValue;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete key', async () => {
			const changes = [
				{
					remove: {
						path: ['jobs', 'Publish'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.jobs.Publish;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to delete multiple keys with array index in path', async () => {
			const changes = [
				{
					remove: {
						path: ['jobs', 'Publish', 'steps', 0, 'name'],
					},
				},
				{
					remove: {
						path: ['jobs', 'Publish', 'steps', 0, 'uses'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.jobs.Publish.steps[0].name;
			delete expectedContents.jobs.Publish.steps[0].uses;

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove an array entry', async () => {
			const changes = [
				{
					remove: {
						path: ['on'],
						value: 'pull_request',
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			expectedContents.on = ['push'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove an array at index', async () => {
			const changes = [
				{
					remove: {
						path: ['on', 1],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			expectedContents.on = ['push'];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove array entries', async () => {
			const changes = [
				{
					remove: {
						path: ['jobs', 'Publish', 'things'],
						values: [1, 2],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			expectedContents.jobs.Publish.things = [];

			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove root level key', async () => {
			const changes = [
				{
					remove: {
						path: ['on'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.on;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove multiple root level keys', async () => {
			const changes = [
				{
					remove: {
						path: ['on'],
					},
				},
				{
					remove: {
						path: ['jobs'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };
			delete expectedContents.on;
			delete expectedContents.jobs;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove nested keys', async () => {
			const changes = [
				{
					remove: {
						path: ['jobs', 'Publish', 'things'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = {
				...getMockDeploy(),
			};
			delete expectedContents.jobs.Publish.things;
			expect(parsed).toStrictEqual(expectedContents);
		});

		it('can use `remove` to remove deep nested keys', async () => {
			const changes = [
				{
					remove: {
						path: ['jobs', 'Publish', 'steps'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = {
				...getMockDeploy(),
			};
			delete expectedContents.jobs.Publish.steps;
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
						path: ['jobs', 'Publish', 'steps', 3, 'dne'],
					},
				},
			];

			await editYAML(options, deployName, changes);

			const contents = await fsp.readFile(deployPath, 'utf8');
			const parsed = YAML.parse(contents);

			const expectedContents = { ...getMockDeploy() };

			expect(parsed).toStrictEqual(expectedContents);
		});
	});
});
