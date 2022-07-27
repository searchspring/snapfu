import { cmp } from './cmp';

describe('cmp function', () => {
	it('can sort versions', async () => {
		const sortedVersions = [
			'0.0.0',
			'0.0.1',
			'0.1.0',
			'0.2.0',
			'0.3.0',
			'0.3.1',
			'0.3.2',
			'0.3.11',
			'0.3.111',
			'1.0.0',
			'1.1.0',
			'1.2.0',
			'1.2.2',
			'1.2.22',
			'1.3.2',
		];

		const shuffledVersions = shuffle(JSON.parse(JSON.stringify(sortedVersions)));
		expect(shuffledVersions).not.toStrictEqual(sortedVersions);

		const attemptedSort = shuffledVersions.sort(cmp);
		expect(attemptedSort).toStrictEqual(sortedVersions);
	});

	it('can sort versions with letters', async () => {
		const sortedVersions = [
			'0.0.0',
			'0.0.1',
			'0.1.0',
			'0.2.0',
			'0.2.0',
			'0.3.0',
			'0.3.1',
			'0.3.1a',
			'0.3.1b',
			'0.3.2',
			'0.3.11',
			'0.3.11a',
			'0.3.11a',
			'0.3.111',
			'1.0.0',
			'1.0.0b',
			'1.0.0c',
			'1.1.0',
			'1.2.0',
			'1.2.2',
			'1.2.22',
			'1.3.2',
		];

		const shuffledVersions = shuffle(JSON.parse(JSON.stringify(sortedVersions)));
		expect(shuffledVersions).not.toStrictEqual(sortedVersions);

		const attemptedSort = shuffledVersions.sort(cmp);
		expect(attemptedSort).toStrictEqual(sortedVersions);
	});
});

const shuffle = (array) => {
	return array.sort(() => Math.random() - 0.5);
};
