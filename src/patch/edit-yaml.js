import YAML from 'yaml';
import { promises as fsp } from 'fs';
import path from 'path';

export const editYAML = async (options, fileName, changes) => {
	if (!changes.length || !fileName) {
		return;
	}

	const projectDir = options.context.project.path;
	const filePath = path.join(projectDir, fileName);

	let contents;
	try {
		await fsp.stat(filePath);
		contents = await fsp.readFile(filePath, 'utf8');
		// file exists
	} catch (err) {
		// file or directory doesn't exist - do nothing
		return;
	}

	let file, originalFile;
	try {
		file = YAML.parse(contents);
		originalFile = YAML.parse(contents);
	} catch (err) {
		throw `editYAML unable to parse ${fileName}`;
	}

	// read changes and apply them to parsed JSON
	for (const change of changes) {
		const action = Object.keys(change)[0];
		const actionSpecifiers = Object.keys(change[action] || {});

		let actionType; // different update types (properties, path)
		if (actionSpecifiers.length == 1 && actionSpecifiers[0] === 'properties') {
			actionType = 'properties';
		} else if (actionSpecifiers.length >= 1 && actionSpecifiers.includes('path')) {
			actionType = 'path';
		}

		switch (action) {
			case 'update': {
				switch (actionType) {
					case 'properties': {
						const keysToChange = Object.keys(change[action].properties);

						for (const keyToUpdate of keysToChange) {
							const value = change[action].properties[keyToUpdate];

							const checkForNestedObj = (obj, value) => {
								if (typeof value == 'object' && !Array.isArray(value)) {
									const valueObjectKeys = Object.keys(value || {});
									valueObjectKeys.forEach((key) => {
										if (!obj) {
											//obj doesnt exist
											obj = {};
											obj[key] = value[key];
										} else if (Array.isArray(obj[key])) {
											obj[key] = obj[key].concat(value[key]);
										} else if (typeof obj[key] == 'object') {
											//obj is object, run it again
											obj[key] = checkForNestedObj(obj[key], value[key]);
										} else {
											obj[key] = value[key];
										}
									});
								} else {
									if (Array.isArray(obj)) {
										obj = obj.concat(value);
									} else {
										obj = value;
									}
								}

								return obj;
							};

							// start recursion
							file[keyToUpdate] = checkForNestedObj(file[keyToUpdate], value);
						}

						break;
					}

					case 'path': {
						const path = change[action].path;
						const value = change[action].value || change[action].values;
						const modifier = change[action].modifier || 'set';

						let fileRef = file;
						path.forEach((entry, index) => {
							if (index != path.length - 1) {
								if (typeof entry == 'string') {
									if (!fileRef[entry]) {
										fileRef[entry] = {};
									}

									fileRef = fileRef[entry];
								} else if (Array.isArray(entry) && entry.length == 1 && Number.isInteger(entry[0])) {
									// path entry is an array with an index
									const index = entry[0];
									if (fileRef[index]) {
										fileRef = fileRef[index];
									}
								}
							} else {
								// last path entry - set the value
								switch (modifier) {
									case 'set': {
										fileRef[entry] = value;
										break;
									}

									case 'append': {
										if (Array.isArray(fileRef[entry])) {
											fileRef[entry] = fileRef[entry].concat(value);
										} else {
											fileRef[entry] = fileRef[entry] + value;
										}

										break;
									}

									case 'prepend': {
										if (Array.isArray(fileRef[entry])) {
											fileRef[entry] = value.concat(fileRef[entry]);
										} else {
											fileRef[entry] = value + fileRef[entry];
										}

										break;
									}

									default:
										break;
								}
							}
						});

						break;
					}

					// no type matches
					default:
						break;
				}

				break;
			}

			case 'remove': {
				switch (actionType) {
					case 'properties': {
						const keysToChange = Object.keys(change[action].properties);

						if (Array.isArray(change[action].properties)) {
							// remove is an array of keys to delete at the top level of file
							change[action].properties.forEach((key) => {
								delete file[key];
							});
						} else if (typeof change[action].properties === 'object') {
							// remove is an object with possible nested properties to delete
							for (const keyToRemove of keysToChange) {
								if (!(keyToRemove in file)) {
									// keyToRemove is not in file
									return;
								}

								let pathToRemove = [];

								const checkfor = (obj) => {
									if (Array.isArray(obj)) {
										// found leaf node (array)
										let initialReference = file[keyToRemove];
										let currentPath = initialReference;

										for (let i = 0; i < pathToRemove.length; i++) {
											currentPath = currentPath[pathToRemove[i]];
										}

										if (Array.isArray(currentPath)) {
											obj.forEach((value) => {
												const index = currentPath.indexOf(value);
												if (index > -1) {
													currentPath.splice(index, 1);
												}
											});
										} else {
											// loop through the obj and delete keys
											obj.forEach((key) => {
												delete currentPath[key];
											});
										}
									} else {
										// is an object, continue until you find an array
										const keys = Object.keys(obj || {});
										for (let i = 0; i < keys.length; i++) {
											pathToRemove.push(keys[i]);
											checkfor(obj[keys[i]]);
										}
									}
								};
								checkfor(change[action].properties[keyToRemove]);
							}
						}

						break;
					}

					case 'path': {
						const path = change[action].path;
						const value = change[action].value || change[action].values;
						const index = change[action].index;

						let fileRef = file;
						path.forEach((entry, i) => {
							if (i != path.length - 1) {
								if (typeof entry == 'string') {
									// path entry is a string navigating object
									fileRef = fileRef[entry];
								} else if (Array.isArray(entry) && entry.length == 1 && Number.isInteger(entry[0])) {
									// path entry is an array with an index
									const index = entry[0];
									if (fileRef[index]) {
										fileRef = fileRef[index];
									}
								}
							} else {
								// last path entry - set the value
								if (!fileRef) return;

								if (!value && typeof index == 'undefined') {
									// remove the path entry entirely
									delete fileRef[entry];
								} else if (fileRef[entry] && Array.isArray(fileRef[entry])) {
									// value removal only makes sense on arrays
									if (typeof index != 'undefined') {
										fileRef[entry].splice(index, 1);
									} else if (value)
										if (Array.isArray(value)) {
											fileRef[entry] = fileRef[entry].filter((val) => !value.includes(val));
										} else {
											const valueIndex = fileRef[entry].indexOf(value);
											if (valueIndex >= 0) {
												fileRef[entry].splice(valueIndex, 1);
											}
										}
								}
							}
						});

						break;
					}

					default:
						break;
				}

				break;
			}

			default:
				break;
		}
	}

	// write changes to file
	if (YAML.stringify(originalFile) !== YAML.stringify(file)) {
		const fileContents = YAML.stringify(file, null, '\t');

		await fsp.writeFile(filePath, fileContents, 'utf8');
	}
};
