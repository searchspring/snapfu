import { listPatches } from './patch.js';

describe('listPatch function', () => {
	it('can list patches', async () => {
		const options = {
			dev: false,
			command: 'patch',
			args: ['list'],
			context: {
				project: {
					path: '/Users/dennis/dev/searchspring-implementations/snap.searchspring.io',
					dirname: 'snap.searchspring.io',
				},
				searchspring: {
					framework: 'preact',
				},
				projectVersion: '0.1.0',
				version: '1.0.24',
			},
		};

		const consoleFn = jest.spyOn(console, 'log');
		await listPatches(options);

		expect(consoleFn).toHaveBeenCalled();

		consoleFn.mockClear();
	});
});
