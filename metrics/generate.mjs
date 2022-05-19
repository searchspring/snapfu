import { promises as fsp } from 'fs';
import { exit } from 'process';

const COVERAGE_FILE = './coverage/coverage-summary.json';
const VERSION_FILE = './package.json';
const METRICS_DIR = './metrics/data';

(async function() {
	try {
		await prepare();

		const now = new Date();
		await generateCoverage(now);
	} catch(err) {
		console.error('unable to process coverage file');
		console.error(err);
		exit(1);
	}
})()

async function prepare() {
	// delete previous metrics (if exists)
	try {
		await fsp.stat(METRICS_DIR)
		await fsp.rm(METRICS_DIR, { recursive: true });
	} catch(err) {
		// file does not exist
	}

	// make metrics directory
	await fsp.mkdir(METRICS_DIR);
}

async function generateCoverage(now) {
	try {
		await fsp.stat(COVERAGE_FILE)
	} catch(err) {
		throw ('no coverage data found!');
	}

	const packageContents = await fsp.readFile(VERSION_FILE, 'utf8');
	const packageData = JSON.parse(packageContents);
	const version = packageData.version;

	if (!version) {
		throw 'no version found!';
	}

	const coverageContents = await fsp.readFile(COVERAGE_FILE, 'utf8');
	const coverageData = JSON.parse(coverageContents);

	const coverage = coverageData && coverageData.total && coverageData.total.lines;
	const filename = `SnapCoverage-snapfu-${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}_${now.getHours()}${now.getMinutes()}.json`;

	const obj = {
		timestamp: now,
		type: "snap-coverage",
		data: { package: 'snapfu', version, total: coverage.total, covered: coverage.covered, percentage: coverage.pct }
	};

	const contents = JSON.stringify(obj, null, '  ');

	await fsp.writeFile(`${METRICS_DIR}/${filename}`, contents);

	console.log(filename);
	console.log(`${contents}\n`);
}
