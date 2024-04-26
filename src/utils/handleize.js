export const handleize = (input) => {
	if (typeof input != 'string') {
		return input;
	}

	let handleized = input.toLowerCase();
	handleized = handleized.replace(/[^\w\s]/g, '').trim();
	handleized = handleized.replace(/\s/g, '-');
	return handleized;
};
