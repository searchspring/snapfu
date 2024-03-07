import { createDir } from './init';
import { copyTransform } from './utils';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import { fail } from 'assert';
import { Readable } from 'stream';
import MemoryStream from 'memorystream';

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
				expect(err).toEqual(`Cannot initialize non-empty directory: ${folder}`);
			});
	});
});

describe('transforms', () => {
	it('replaces variables', async () => {
		let buf = Buffer.from('name {{ snapfu.name}} by {{ snapfu.author }}', 'utf8');
		let write = MemoryStream.createWriteStream();
		let variables = {
			'snapfu.name': 'destination name',
			'snapfu.author': 'codeallthethingz',
		};
		copyTransform(Readable.from(buf), write, variables, {
			name: 'package.json',
		});

		write.on('end', () => {
			expect(write.toString()).toEqual('name destination name by codeallthethingz');
		});

		write = MemoryStream.createWriteStream();
		copyTransform(Readable.from(buf), write, variables, {
			name: 'package.yml',
		});

		write.on('end', () => {
			expect(write.toString()).toEqual('name destination name by codeallthethingz');
		});
	});
	it('will not replace for all file types', async () => {
		let read = Readable.from(Buffer.from('{{snapfu.name}}', 'utf8'));
		let write = MemoryStream.createWriteStream();
		await copyTransform(
			read,
			write,
			{
				'snapfu.name': 'destination name',
			},
			{ name: 'something.icon' }
		);

		write.on('end', () => {
			expect(write.toString()).toEqual('{{snapfu.name}}');
		});
	});
});
