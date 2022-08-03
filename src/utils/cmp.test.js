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
			'0.3.1-1',
			'0.3.1-1',
			'0.3.2',
			'0.3.11',
			'0.3.11-1',
			'0.3.11-2',
			'0.3.11-3',
			'0.3.11-4',
			'0.3.11-5',
			'0.3.11-11',
			'0.3.11-12',
			'0.3.11-111',
			'0.3.11-112',
			'0.3.11-1111',
			'0.3.11-1112',
			'0.3.111',
			'1.0.0',
			'1.0.0-2',
			'1.0.0-3',
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
