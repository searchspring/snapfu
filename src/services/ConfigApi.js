import fetch from 'node-fetch';

export const API_HOST = 'https://smc-config-api.kube.searchspring.io';
export const DEV_API_HOST = 'http://localhost:9999';

export class ConfigApi {
	host = API_HOST;
	userAgent = '';
	secretKey = '';

	constructor(secretKey, dev) {
		this.secretKey = secretKey || '';

		if (dev) {
			this.host = DEV_API_HOST;
		}
	}

	async validateSite(siteId) {
		const apiPath = `${this.host}/api/customer/${siteId}/verifyKey`;

		const response = await fetch(apiPath, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 404) {
			throw new Error(`Invalid siteid and/or secretKey.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}

	async getTemplates() {
		const apiPath = `${this.host}/api/recsTemplates`;

		const response = await fetch(apiPath, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}

	async getBadgeTemplates() {
		const apiPath = `${this.host}/api/badgeTemplates`;

		const response = await fetch(apiPath, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}

	async putTemplate(payload) {
		const apiPath = `${this.host}/api/recsTemplate`;

		const response = await fetch(apiPath, {
			method: 'PUT',
			body: JSON.stringify(payload),
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}

	async putBadgeLocations(payload) {
		const apiPath = `${this.host}/api/badgeLocations`;

		const response = await fetch(apiPath, {
			method: 'PUT',
			body: JSON.stringify(payload),
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}

	async putBadgeTemplate(payload) {
		const apiPath = `${this.host}/api/badgeTemplate`;

		const response = await fetch(apiPath, {
			method: 'PUT',
			body: JSON.stringify(payload),
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}

	async archiveTemplate(payload) {
		const apiPath = `${this.host}/api/recsTemplate`;

		const response = await fetch(apiPath, {
			method: 'DELETE',
			body: JSON.stringify(payload),
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 404) {
			throw new Error(`Template '${payload.name}' not found. Ensure correct branch and template name is specified.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 409) {
			const text = (await response.text()).trim();
			throw new Error(`Cannot archive ${text}`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}
	async archiveBadgeTemplate(payload) {
		const apiPath = `${this.host}/api/badgeTemplate`;

		const response = await fetch(apiPath, {
			method: 'DELETE',
			body: JSON.stringify(payload),
			headers: {
				Accept: 'application/json',
				Authorization: this.secretKey,
				'User-Agent': this.userAgent,
			},
		});

		if (response.status == 200) {
			return await response.json();
		} else if (response.status == 401) {
			throw new Error(`Invalid secretKey.`);
		} else if (response.status == 404) {
			throw new Error(`Template '${payload.name}' not found. Ensure correct template name is specified.`);
		} else if (response.status == 405) {
			throw new Error(`Server method not allowed.`);
		} else if (response.status == 409) {
			const text = (await response.text()).trim();
			throw new Error(`Cannot archive ${text}`);
		} else if (response.status == 429) {
			const text = (await response.text()).trim();
			throw new Error(`Try again: ${text}`);
		} else if (response.status == 500) {
			throw new Error(`Server encounterd a problem.`);
		} else {
			throw new Error(`Unknown error has occured.`);
		}
	}
}
