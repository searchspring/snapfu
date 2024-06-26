import path from 'path';
import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import { promises as fsp } from 'fs';

import { findReplace } from './find-replace.js';

// Example YAML Patch File Contents
/*
	steps:
		- files:
			package.json:
				action: find-replace
				changes:
					- replace: 
						pattern: 'preact'
						replacement: 'preact2'
*/

const mockJSON = {
	version: '1.2.3',
	searchspring: {
		version: '0.0.1',
		siteId: 'ga9kq2',
		framework: 'preact',
		platform: 'bigcommerce',
		template: 'snapfu-template-preact',
		tags: ['finder', 'ac', 'email'],
	},
};
const mockText = `Hello World!`;

let projectDirRoot = '';
let projectDir = '';
let jsonFileName = '';
let jsonFile = '';
let textFileName = '';
let textFile = '';
let options;

beforeAll(async () => {
	// setup project
	projectDirRoot = path.join(tempDirectory, Math.random() + '');
	projectDir = path.join(projectDirRoot, 'projects/secret.project');

	// create directoriess
	fs.mkdirsSync(projectDir, true);

	jsonFileName = 'file.json';
	jsonFile = path.join(projectDir, jsonFileName);

	textFileName = 'file.txt';
	textFile = path.join(projectDir, textFileName);

	options = {
		context: {
			project: {
				path: projectDir,
			},
		},
	};
});

beforeEach(async () => {
	await fsp.writeFile(jsonFile, JSON.stringify(mockJSON));
	await fsp.writeFile(textFile, mockText);
});

describe('findReplace function', () => {
	it(`doesn't do anything when there are no filename`, async () => {
		const changes = [{ replace: { pattern: 'one', replacement: '1' } }];
		await findReplace(options, '', changes);

		const jsonContents = await fsp.readFile(jsonFile, 'utf8');
		expect(jsonContents).toStrictEqual(JSON.stringify(mockJSON));

		const textContents = await fsp.readFile(textFile, 'utf8');
		expect(textContents).toStrictEqual(mockText);
	});

	it(`doesn't do anything when there are no changes`, async () => {
		const changes = [];

		await findReplace(options, jsonFileName, changes);
		const jsonContents = await fsp.readFile(jsonFile, 'utf8');
		expect(jsonContents).toStrictEqual(JSON.stringify(mockJSON));

		await findReplace(options, textFileName, changes);
		const textContents = await fsp.readFile(textFile, 'utf8');
		expect(textContents).toStrictEqual(mockText);
	});

	it(`doesn't do anything if changes are invalid`, async () => {
		const changes = [{ replace: { bad: 'one', key: '1' } }];

		await findReplace(options, jsonFileName, changes);
		const jsonContents = await fsp.readFile(jsonFile, 'utf8');
		expect(jsonContents).toStrictEqual(JSON.stringify(mockJSON));

		await findReplace(options, textFileName, changes);
		const textContents = await fsp.readFile(textFile, 'utf8');
		expect(textContents).toStrictEqual(mockText);
	});

	it(`doesn't do anything if pattern don't match`, async () => {
		const changes = [{ replace: { pattern: 'dne', replacement: 'does not exist' } }];

		await findReplace(options, jsonFileName, changes);
		const jsonContents = await fsp.readFile(jsonFile, 'utf8');
		expect(jsonContents).toStrictEqual(JSON.stringify(mockJSON));

		await findReplace(options, textFileName, changes);
		const textContents = await fsp.readFile(textFile, 'utf8');
		expect(textContents).toStrictEqual(mockText);
	});

	it(`doesn't do anything if pattern is invalid`, async () => {
		const changes = [{ replace: { pattern: 'invalid)', replacement: 'invalid' } }];

		await findReplace(options, jsonFileName, changes);
		const jsonContents = await fsp.readFile(jsonFile, 'utf8');
		expect(jsonContents).toStrictEqual(JSON.stringify(mockJSON));

		await findReplace(options, textFileName, changes);
		const textContents = await fsp.readFile(textFile, 'utf8');
		expect(textContents).toStrictEqual(mockText);
	});

	it(`performs changes as expected`, async () => {
		const changes = [
			{ replace: { pattern: 'snapfu-template-preact', replacement: 'snapfu-scaffold-preact' } },
			{ replace: { pattern: 'ello', replacement: 'ELLO' } },
			{ replace: { pattern: '!$', replacement: '@' } },
		];

		await findReplace(options, jsonFileName, changes);
		const jsonContents = await fsp.readFile(jsonFile, 'utf8');

		const expectedJSON = {
			...mockJSON,
			searchspring: {
				...mockJSON.searchspring,
				template: 'snapfu-scaffold-preact',
			},
		};

		expect(jsonContents).toStrictEqual(JSON.stringify(expectedJSON));

		await findReplace(options, textFileName, changes);
		const textContents = await fsp.readFile(textFile, 'utf8');
		expect(textContents).toStrictEqual('HELLO World@');
	});
});
