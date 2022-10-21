import child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export async function commandOutput(cmd, dir) {
	let returnObj = {};

	if (cmd) {
		const output = await exec(cmd, { cwd: dir });
		if (output.err) throw err;

		returnObj = output;
	}
	return returnObj;
}
