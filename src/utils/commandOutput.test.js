import { commandOutput } from './commandOutput';

describe('commandOutput function', () => {
	it('executes a command and returns the output', async () => {
		const { stderr, stdout } = await commandOutput('echo "hello world"');
		expect(stdout).toBe('hello world\n');
		expect(stderr).toBe('');
	});
});
