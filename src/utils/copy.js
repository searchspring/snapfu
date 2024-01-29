import ncp from 'ncp';
import replaceStream from 'replacestream';

export function copy(source, destination, options) {
	return new Promise((resolutionFunc, rejectionFunc) => {
		// ncp can be used to modify the files while copying - see https://www.npmjs.com/package/ncp
		ncp(source, destination, options, function (err) {
			if (err) {
				rejectionFunc(err);
			}
			resolutionFunc();
		});
	});
}

export const copyTransform = function (read, write, variables, file) {
	if (
		file.name.endsWith('.md') ||
		file.name.endsWith('.html') ||
		file.name.endsWith('.json') ||
		file.name.endsWith('.yml') ||
		file.name.endsWith('.scss') ||
		file.name.endsWith('.sass') ||
		file.name.endsWith('.jsx') ||
		file.name.endsWith('.ts') ||
		file.name.endsWith('.tsx') ||
		file.name.endsWith('.js')
	) {
		// create and pipe through multiple replaceStreams
		let pipeline = read;
		Object.keys(variables).forEach(function (variable) {
			let value = variables[variable];
			let regex = new RegExp('{{\\s*' + variable + '\\s*}}', 'gi');
			pipeline = pipeline.pipe(replaceStream(regex, value));
		});

		pipeline.pipe(write);
		// write.write(content);
	} else {
		read.pipe(write);
	}
};
