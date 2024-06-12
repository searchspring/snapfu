import { promises as fsp } from 'fs';
import path from 'path';

export const findReplace = async (options, fileName, changes) => {
	if (!changes.length || !fileName) {
		return;
	}

	const projectDir = options.context.project.path;
	const filePath = path.join(projectDir, fileName);

	let originalContents, newContents;
	try {
		await fsp.stat(filePath);
		originalContents = await fsp.readFile(filePath, 'utf8');
		// file exists
	} catch (err) {
		// file or directory doesn't exist - do nothing
		return;
	}

	// read changes and apply them to parsed JSON
	for (const change of changes) {
		const { pattern, replacement } = change.replace;
		if (!pattern || !replacement) {
			continue;
		}

		let regex;
		try {
			regex = new RegExp(pattern, 'gm');
		} catch (e) {
			console.error(`Invalid regex pattern: ${pattern}`);
			continue;
		}
		newContents = (newContents || originalContents).replace(regex, replacement);
	}

	// write changes to file
	if (newContents && originalContents !== newContents) {
		await fsp.writeFile(filePath, newContents, 'utf8');
	}
};
