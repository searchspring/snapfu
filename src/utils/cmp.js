export const cmp = (a, b) => {
	const pa = a.split('.');
	const pb = b.split('.');
	for (let i = 0; i < 3; i++) {
		const na = Number(pa[i]);
		const nb = Number(pb[i]);

		if (i === 2 && (isNaN(na) || isNaN(nb))) {
			// last digit & has letter
			const a_number = Number(pa[i].match(/(0|[1-9]\d*)/)[0]);
			const a_letter = ((pa[i].match(/[a-zA-Z]+$/) || [])[0] || '').toLowerCase();

			const b_number = Number(pb[i].match(/(0|[1-9]\d*)/)[0]);
			const b_letter = ((pb[i].match(/[a-zA-Z]+$/) || [])[0] || '').toLowerCase();

			if (a_number > b_number) {
				return 1;
			}
			if (b_number > a_number) {
				return -1;
			}
			if (a_number == b_number) {
				if (!b_letter) {
					return 1;
				}
				if (!a_letter) {
					return -1;
				}
				if (a_letter.charCodeAt() > b_letter.charCodeAt(0)) {
					return 1;
				}
				if (b_letter.charCodeAt() > a_letter.charCodeAt(0)) {
					return -1;
				}
			}
		}

		if (na > nb) return 1;
		if (nb > na) return -1;
		if (!isNaN(na) && isNaN(nb)) return 1;
		if (isNaN(na) && !isNaN(nb)) return -1;
	}
	return 0;
};
