import { boxify, boxifyVersions } from './boxify';

describe('boxify function', () => {
	it('wraps first parameter in a box', () => {
		const contents = 'inside';
		const boxified = boxify(contents);

		expect(boxified.includes(contents)).toBe(true);
	});
});

describe('boxifyVersions function', () => {
	it('puts versions in separate boxes', () => {
		const v1 = '0.0.1';
		const v2 = '0.0.2';
		const boxified = boxifyVersions(v1, v2);

		expect(boxified.includes(v1)).toBe(true);
		expect(boxified.includes(v2)).toBe(true);
	});
});
