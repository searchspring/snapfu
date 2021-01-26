const { createDir, transform } = require('./init');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { fail } = require('assert');
const { Readable } = require('stream');
const MemoryStream = require('memorystream');

beforeEach(async () => {});

describe('check empty dir', () => {
	it('is empty', async () => {
		let folder = await fs.mkdtemp(path.join(os.tmpdir(), 'snapfutest-')).then(async (folder, err) => {
			if (err) throw err;
			await fs.writeFile(folder + '/somefile.txt', 'some content');
			return folder;
		});
		await createDir(folder)
			.then(() => {
				fail();
			})
			.catch((err) => {
				expect(err).toEqual('folder not empty, exiting');
			});
	});
});

describe('transforms', () => {
	it('replace tokens', async () => {
		let buf = Buffer.from('name {{  snapfu.name}} by {{snapfu.author}}', 'utf8');
		let write = MemoryStream.createWriteStream();
		let transforms = {
			'snapfu.name': 'destination name',
			'snapfu.author': 'codeallthethingz',
		};
		await transform(Readable.from(buf), write, transforms, {
			name: 'package.yml',
		});
		expect(write.toString()).toEqual('name destination name by codeallthethingz');

		write = MemoryStream.createWriteStream();
		await transform(Readable.from(buf), write, transforms, {
			name: 'package.json',
		});
		expect(write.toString()).toEqual('name destination name by codeallthethingz');
	});
	it('edges', async () => {
		let read = Readable.from(Buffer.from('{{snapfu.name}}', 'utf8'));
		let write = MemoryStream.createWriteStream();
		await transform(
			read,
			write,
			{
				'snapfu.name': 'destination name',
			},
			{ name: 'something.icon' }
		);
		expect(write.toString()).toEqual('{{snapfu.name}}');
	});
});
