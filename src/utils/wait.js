export const wait = (us) => {
	return new Promise((resolve) => {
		setTimeout(resolve, us);
	});
};
