import { help } from './help';

describe('help function', () => {
	it('logs text based on the subject matter', async () => {
		const consoleSpy = jest.spyOn(console, 'log');

		help({ command: 'help', args: ['coding'] });

		expect(consoleSpy).toHaveBeenCalled();
	});
});
