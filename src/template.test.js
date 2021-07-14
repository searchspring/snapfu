import {
	timeout,
	capitalizeFirstLetter,
	buildTemplatePayload,
	findTemplateFiles,
	readTemplateSettings,
	writeTemplateSettings,
	getTemplates,
	generateTemplateSettings,
} from './template';
import tempDirectory from 'temp-dir';
import fs from 'fs-extra';
import path from 'path';
import { promises as fsp, write } from 'fs';

const mockPackageJSON = {
	searchspring: {
		siteId: 'ga9kq2',
		framework: 'preact',
		platform: 'bigcommerce',
		tags: ['finder'],
	},
};

const mockTemplateSettings = {
	name: 'thing',
	label: 'thing',
	description: 'thing custom template.',
	component: 'Thing',
	orientation: 'horizontal',
	parameters: [
		{
			name: 'title',
			label: 'Title',
			description: 'text used for the heading',
			defaultValue: 'Recommended Products',
		},
	],
};

const mockCreds = { login: 'mylogin', name: 'myname', token: 'xyz' };

let homeDir = '';
let projectDirRoot = '';
let projectDir = '';
let projectDirRecs = '';
let packagePath = '';
let recsSettings1Path = '';
let recsSettings2Path = '';
let recsSettings3Path = '';
let recsSettings4Path = '';

beforeAll(async () => {
	// setup creds
	homeDir = path.join(tempDirectory, Math.random() + '');
	fs.mkdirsSync(path.join(homeDir, '.searchspring'));
	await fsp.writeFile(path.join(homeDir, '.searchspring/creds.json'), JSON.stringify(mockCreds));

	// setup project
	projectDirRoot = path.join(tempDirectory, Math.random() + '');
	projectDir = path.join(projectDirRoot, 'workbox/projects/Snapps/secret.project');
	projectDirRecs = path.join(projectDir, 'src/components/Recommendations');

	fs.mkdirsSync(projectDir, true);
	fs.mkdirsSync(projectDirRecs, true);

	packagePath = path.join(projectDir, 'package.json');
	await fsp.writeFile(packagePath, JSON.stringify(mockPackageJSON));

	fs.mkdirsSync(path.join(projectDirRecs, 'Recs1'), true);
	fs.mkdirsSync(path.join(projectDirRecs, 'Recs2'), true);
	fs.mkdirsSync(path.join(projectDirRecs, 'Recs3'), true);
	recsSettings1Path = path.join(projectDirRecs, 'Recs1/Recs1.json');
	recsSettings2Path = path.join(projectDirRecs, 'Recs2/Recs2.json');
	recsSettings3Path = path.join(projectDirRecs, 'Recs3/Recs3.json');
	recsSettings4Path = path.join(projectDirRecs, 'Recs4.json');

	await fsp.writeFile(recsSettings1Path, JSON.stringify(mockTemplateSettings));
	await fsp.writeFile(recsSettings2Path, JSON.stringify(mockTemplateSettings));
	await fsp.writeFile(recsSettings3Path, JSON.stringify({}));
	await fsp.writeFile(recsSettings4Path, JSON.stringify(mockTemplateSettings));
});

afterAll(() => {
	fs.emptyDirSync(homeDir, (err) => {
		if (err) return console.error(err);
	});

	fs.emptyDirSync(projectDirRoot, (err) => {
		if (err) return console.error(err);
	});
});

describe('generateTemplateSettings function', () => {
	it('returns a stringified object with template settings', async () => {
		const name = 'Newness';
		const settingsString = generateTemplateSettings(name);
		expect(settingsString).toBeDefined();

		const settings = JSON.parse(settingsString);
		expect(settings).toHaveProperty('name', name.toLowerCase());
		expect(settings).toHaveProperty('label', name);
		expect(settings).toHaveProperty('description');
		expect(settings).toHaveProperty('component', capitalizeFirstLetter(name));
		expect(settings).toHaveProperty('orientation');
		expect(settings).toHaveProperty('parameters');
	});
});

describe('getTemplates function', () => {
	it('returns an empty array on error', async () => {
		const files = await getTemplates('some/place');
		expect(files).toStrictEqual([]);
	});

	it('returns an array of template objects with properties', async () => {
		const files = await getTemplates(projectDirRoot);
		files.forEach((file) => {
			expect(file).toHaveProperty('path');
			expect(file).toHaveProperty('details');
		});
	});

	it('filters out json files that are not valid template settings', async () => {
		const files = await getTemplates(projectDirRoot);
		expect(files.length).toBe(2);
	});
});

describe('writeTemplateSettings function', () => {
	it('will not write to existing file', async () => {
		const newSettings = {
			name: 'not allowed',
		};

		const contents = await readTemplateSettings(recsSettings1Path);
		expect(contents).toStrictEqual(mockTemplateSettings);
		await writeTemplateSettings(recsSettings1Path, JSON.stringify(newSettings));
		const overwrittenContents = await readTemplateSettings(recsSettings1Path);
		expect(overwrittenContents).not.toStrictEqual(newSettings);
		expect(overwrittenContents).toStrictEqual(mockTemplateSettings);
	});

	it('writes to files that do not exist', async () => {
		const newSettings = {
			name: 'not allowed',
		};

		const newSettingsPath = path.join(projectDirRecs, 'newSettings.json');
		await writeTemplateSettings(newSettingsPath, JSON.stringify(newSettings));
		const contents = await readTemplateSettings(newSettingsPath);
		expect(contents).toStrictEqual(newSettings);
	});
});

describe('readTemplateSettings function', () => {
	it('returns empty when invalid file path provided', async () => {
		const contents = await readTemplateSettings('some/path');
		expect(contents).toStrictEqual({});
	});

	it('returns contents of json file', async () => {
		const contents = await readTemplateSettings(recsSettings1Path);
		expect(contents).toStrictEqual(mockTemplateSettings);
	});
});

describe('findTemplateFiles function', () => {
	it('expects a directory as the first parameter', async () => {
		expect(async () => {
			const files = await findTemplateFiles('some/place');
		}).rejects.toThrow();
	});

	it('looks for json files that have the same name as the directory they are in', async () => {
		const files = await findTemplateFiles(projectDirRoot);

		expect(files.length).toBe(3);
	});
});

describe('buildTemplatePayload function', () => {
	it('transforms a template settings into API payload', async () => {
		const vars = { branch: 'my-branch', framework: 'preact' };

		const transformed = buildTemplatePayload(mockTemplateSettings, vars);
		expect(transformed).toHaveProperty('name');
		expect(transformed).toHaveProperty('component');
		expect(transformed).toHaveProperty('meta');
		expect(transformed).toHaveProperty('parameters');
	});
});

describe('capitalizeFirstLetter function', () => {
	it('sets the first character to uppercase', async () => {
		const uppered = capitalizeFirstLetter('testString');
		expect(uppered).toBe('TestString');
	});
});

describe('timeout function', () => {
	it('waits for set amount of time', async () => {
		const timeToWait = 500;

		const now = Date.now();
		await timeout(timeToWait);
		const later = Date.now();

		const timeBetween = later - now;
		expect(timeBetween).toBeGreaterThanOrEqual(timeToWait);
	});
});
