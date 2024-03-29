import { promises as fsp } from 'fs';
import path from 'path';
import deepmerge from 'deepmerge';

export const editJSON = async (options, fileName, changes) => {
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
		file = JSON.parse(contents);
		originalFile = JSON.parse(contents);
	} catch (err) {
		throw `editJSON unable to parse ${fileName}`;
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
											// obj doesnt exist
											obj = {};
											obj[key] = value[key];
										} else if (Array.isArray(obj[key])) {
											obj[key] = obj[key].concat(value[key]);
										} else if (typeof obj[key] == 'object') {
											// obj is object, run it again
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
								} else if (Number.isInteger(entry)) {
									// path entry is an index
									if (fileRef[entry]) {
										fileRef = fileRef[entry];
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

			case 'move': {
				switch (actionType) {
					case 'path': {
						const path = change[action].path;
						const newPath = change[action].newPath;
						let modifier = change[action].modifier;

						let fileRef = file;
						let newFileRef = file;
						path.forEach((entry, i) => {
							if (i != path.length - 1) {
								if (typeof entry == 'string') {
									// path entry is a string navigating object
									if (fileRef[entry]) {
										fileRef = fileRef[entry];
									} else {
										// path does not exist, cannot continue
										return;
									}
								}
							} else {
								// last path entry - prepare to move

								if (!fileRef || !fileRef[entry]) {
									// fileRef not found
									return;
								}

								// check for existence of newPath
								newPath.forEach((newEntry, i) => {
									if (i != newPath.length - 1) {
										if (typeof newEntry == 'string') {
											// path newEntry is a string navigating object
											if (newFileRef[newEntry]) {
												newFileRef = newFileRef[newEntry];
											} else {
												// path does not exist, must create it
												newFileRef = newFileRef[newEntry] = {};
											}
										}
									} else {
										// final newPath newEntry
										const existingType = typeof newFileRef[newEntry];

										if (existingType != 'undefined' && !modifier) {
											// newPath already exists and no modifier is present
											return;
										}

										if (existingType == 'string') modifier = 'overwrite';

										switch (modifier) {
											case 'merge': {
												newFileRef[newEntry] = deepmerge(newFileRef[newEntry], fileRef[entry]);
												break;
											}
											default:
											case 'replace': {
												newFileRef[newEntry] = fileRef[entry];
												break;
											}
										}

										// remove original path entry
										delete fileRef[entry];
									}
								});
							}
						});

						break;
					}

					default:
						break;
				}

				break;
			}

			case 'remove': {
				switch (actionType) {
					case 'properties': {
						if (Array.isArray(change[action].properties)) {
							// remove is an array of keys to delete at the top level of file
							change[action].properties.forEach((key) => {
								delete file[key];
							});
						} else if (typeof change[action].properties === 'object') {
							// remove is an object with possible nested properties to delete

							const keysToChange = Object.keys(change[action].properties);

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
								} else if (Number.isInteger(entry)) {
									// path entry is an index
									if (fileRef[entry]) {
										fileRef = fileRef[entry];
									}
								}
							} else {
								// last path entry - set the value

								if (!fileRef) {
									// fileRef not found
									return;
								}

								if (typeof value == 'undefined') {
									if (Array.isArray(fileRef) && Number.isInteger(entry)) {
										// remove array entry
										fileRef.splice(entry, 1);
									} else {
										// remove the path entry entirely
										delete fileRef[entry];
									}
								} else if (fileRef[entry] && Array.isArray(fileRef[entry])) {
									// value removal only makes sense on arrays

									const valuesToRemove = Array.isArray(value) ? value : [value];

									fileRef[entry] = fileRef[entry].filter((val) => !valuesToRemove.includes(val));
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
	if (JSON.stringify(originalFile) !== JSON.stringify(file)) {
		const fileContents = JSON.stringify(file, null, '\t');

		await fsp.writeFile(filePath, fileContents, 'utf8');
	}
};
