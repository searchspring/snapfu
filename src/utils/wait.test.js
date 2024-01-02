import { wait } from './wait';

describe('wait function', () => {
	it('waits a specified time', async () => {
		const startTime = Date.now();
		const waitTime = 333;

		await wait(waitTime);

		const stopTime = Date.now();
		expect(Math.ceil(stopTime) - Math.ceil(startTime)).toBeGreaterThanOrEqual(waitTime);
	});
});
