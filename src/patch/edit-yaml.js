import YAML from 'yaml';
import { promises as fsp } from 'fs';
import path from 'path';

const YAML_STRING_OPTIONS = { lineWidth: 0, minContentWidth: 0, indent: 2 };

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

	let doc, originalFile;
	try {
		doc = YAML.parseDocument(contents, { toStringDefaults: YAML_STRING_OPTIONS });
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
							const properties = change[action].properties[keyToUpdate];

							const setChange = (path, value) => {
								const currentValue = doc.getIn(path);

								if (typeof value == 'object' && !Array.isArray(value)) {
									const valueObjectKeys = Object.keys(value || {});
									valueObjectKeys.forEach((key) => {
										// add key to path
										const newPath = [...path, key];
										const keyValue = doc.getIn(newPath);

										if (keyValue?.items && !YAML.isMap(keyValue)) {
											doc.setIn(newPath, keyValue.items.concat(value[key]));
										} else if (YAML.isMap(keyValue)) {
											// patch contains object, run it again
											setChange(newPath, value[key]);
										} else {
											doc.setIn(newPath, value[key]);
										}
									});
								} else {
									if (currentValue && currentValue.items) {
										doc.setIn(path, currentValue.items.concat(value));
									} else {
										doc.setIn(path, value);
									}
								}
							};

							setChange([keyToUpdate], properties);
						}

						break;
					}

					case 'path': {
						const path = change[action].path;
						const value = change[action].value || change[action].values;
						const modifier = change[action].modifier || 'set';

						if (value) {
							switch (modifier) {
								case 'set': {
									doc.setIn(path, value);
									break;
								}

								case 'append': {
									const currentValue = doc.getIn(path, true);

									if (currentValue && currentValue.items) {
										doc.setIn(path, currentValue.items.concat(value));
									} else if (currentValue) {
										doc.setIn(path, currentValue + value);
									}

									break;
								}

								case 'prepend': {
									const currentValue = doc.getIn(path, true);

									if (currentValue && currentValue.items) {
										doc.setIn(path, value.concat(currentValue.items));
									} else if (currentValue) {
										doc.setIn(path, value + currentValue);
									}

									break;
								}

								default:
									break;
							}
						}

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
						if (Array.isArray(change[action].properties)) {
							// remove is an array of keys to delete at the top level of file
							change[action].properties.forEach((key) => {
								doc.deleteIn([key]);
							});
						} else if (typeof change[action].properties === 'object') {
							// remove is an object with possible nested properties to delete
							const keysToChange = Object.keys(change[action].properties);

							for (const keyToUpdate of keysToChange) {
								const properties = change[action].properties[keyToUpdate];

								const setChange = (path, value) => {
									const currentValue = doc.getIn(path);

									if (typeof value == 'object' && !Array.isArray(value)) {
										const valueObjectKeys = Object.keys(value || {});
										valueObjectKeys.forEach((key) => {
											// add key to path
											const newPath = [...path, key];

											const keyValue = doc.getIn(newPath);

											if (keyValue?.items && !YAML.isMap(keyValue)) {
												const valuesToRemove = Array.isArray(value[key]) ? value[key] : [value[key]];
												doc.setIn(
													[...path, key],
													keyValue.items.filter((item) => !valuesToRemove.includes(item.value))
												);
											} else if (YAML.isMap(keyValue)) {
												// path contains object, run it again
												setChange(newPath, value[key]);
											}
										});
									} else {
										if (currentValue?.items && !YAML.isMap(currentValue)) {
											// encountered an array
											const valuesToRemove = Array.isArray(value) ? value : [value];
											doc.setIn(
												path,
												currentValue.items.filter((item) => !valuesToRemove.includes(item.value))
											);
										} else {
											// remove the path entry entirely
											const valuesToRemove = Array.isArray(value) ? value : [value];
											for (const val of valuesToRemove) {
												doc.deleteIn([...path, val]);
											}
										}
									}
								};

								setChange([keyToUpdate], properties);
							}
						}

						break;
					}

					case 'path': {
						const path = change[action].path;
						const value = change[action].value || change[action].values;
						const index = change[action].index;
						const currentValue = doc.getIn(path, true);

						if (currentValue) {
							if (!value && typeof index == 'undefined') {
								// remove the path entry entirely
								doc.deleteIn(path);
							} else if (currentValue?.items) {
								// value removal only makes sense on arrays
								if (typeof index != 'undefined') {
									doc.setIn(
										path,
										currentValue.items.filter((val, i) => i != index)
									);
								} else if (value) {
									if (Array.isArray(value)) {
										doc.setIn(
											path,
											currentValue.items.filter((item) => !value.includes(item.value))
										);
									} else {
										const valueIndex = currentValue.items.findIndex((item) => item.value == value);

										if (valueIndex >= 0) {
											doc.setIn(path, currentValue.items.splice(index, 1));
										}
									}
								}
							}
						}

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
	if (YAML.stringify(originalFile) !== YAML.stringify(doc, YAML_STRING_OPTIONS)) {
		const fileContents = YAML.stringify(doc, YAML_STRING_OPTIONS);

		await fsp.writeFile(filePath, fileContents, 'utf8');
	}
};
