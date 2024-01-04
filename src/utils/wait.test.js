import { wait } from './wait';

describe('wait function', () => {
	it('waits a specified time', async () => {
		const startTime = Date.now();
		const waitTime = 333;

		await wait(waitTime);

		const stopTime = Date.now();
		expect(stopTime - startTime + 1).toBeGreaterThanOrEqual(waitTime);
	});
});
