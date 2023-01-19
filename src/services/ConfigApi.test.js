import { ConfigApi, API_HOST, DEV_API_HOST } from './ConfigApi';

jest.mock('node-fetch');
import fetch from 'node-fetch';
const { Response } = jest.requireActual('node-fetch');

describe('ConfigApi Class', () => {
	it('can be constructed without any parameters', () => {
		const api = new ConfigApi();

		expect(api).toBeDefined();
		expect(api.host).toBe(API_HOST);
		expect(api.userAgent).toBe('');
		expect(api.secretKey).toBe('');
	});

	it('can be constructed for development usage', () => {
		const api = new ConfigApi('', true);

		expect(api).toBeDefined();
		expect(api.host).toBe(DEV_API_HOST);
		expect(api.userAgent).toBe('');
		expect(api.secretKey).toBe('');
	});

	it('can be constructed with a secretKey', () => {
		const secretKey = 'secret';
		const api = new ConfigApi(secretKey);

		expect(api).toBeDefined();
		expect(api.host).toBe(API_HOST);
		expect(api.userAgent).toBe('');
		expect(api.secretKey).toBe(secretKey);
	});

	describe('validateSite method', () => {
		it('makes a request for validating a site and returns the response', async () => {
			const mockResponse = '{"credentials": "verified"}';
			fetch.mockReturnValue(Promise.resolve(new Response(mockResponse, { status: 200 })));

			const siteId = 'abc123';
			const secretKey = 'secret';

			const api = new ConfigApi(secretKey, true);

			const response = await api.validateSite(siteId);

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledWith(`${DEV_API_HOST}/api/customer/${siteId}/verifyKey`, {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: secretKey,
					'User-Agent': '',
				},
			});

			expect(response).toStrictEqual(JSON.parse(mockResponse));
			fetch.mockRestore();
		});

		it('throws when given responses other than 200', async () => {
			const errorCodes = [400, 401, 404, 405, 429, 500];

			for (const errorCode of errorCodes) {
				fetch.mockReturnValue(Promise.resolve(new Response('', { status: errorCode })));

				const siteName = 'website.com';
				const siteId = 'abc123';
				const secretKey = 'invalidsecret';

				const api = new ConfigApi(secretKey, true);

				await expect(api.validateSite(siteName, siteId)).rejects.toThrow();
			}

			fetch.mockRestore();
		});
	});

	describe('getTemplates method', () => {
		it('makes a request for templates in a site and returns the response', async () => {
			const mockResponse = '{"templates": []}';
			fetch.mockReturnValue(Promise.resolve(new Response(mockResponse, { status: 200 })));

			const siteName = 'website.com';
			const siteId = 'abc123';
			const secretKey = 'secret';

			const api = new ConfigApi(secretKey, true);

			const response = await api.getTemplates();

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledWith(`${DEV_API_HOST}/api/recsTemplates`, {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: secretKey,
					'User-Agent': '',
				},
			});

			expect(response).toStrictEqual(JSON.parse(mockResponse));

			fetch.mockRestore();
		});

		it('throws when given responses other than 200', async () => {
			const errorCodes = [400, 401, 404, 405, 429, 500];

			for (const errorCode of errorCodes) {
				fetch.mockReturnValue(Promise.resolve(new Response('', { status: errorCode })));

				const secretKey = 'invalidsecret';

				const api = new ConfigApi(secretKey, true);

				await expect(api.getTemplates()).rejects.toThrow();
			}

			fetch.mockRestore();
		});
	});

	describe('putTemplate method', () => {
		it('makes a request for uploading a template for a site', async () => {
			const mockResponse = '{"put": "the template"}';
			fetch.mockReturnValue(Promise.resolve(new Response(mockResponse, { status: 200 })));

			const secretKey = 'secret';

			const api = new ConfigApi(secretKey, true);

			const payload = {
				name: 'fakename',
				body: 'fakebody',
			};

			const response = await api.putTemplate(payload);

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledWith(`${DEV_API_HOST}/api/recsTemplate`, {
				method: 'PUT',
				body: JSON.stringify(payload),
				headers: {
					Accept: 'application/json',
					Authorization: secretKey,
					'User-Agent': '',
				},
			});

			expect(response).toStrictEqual(JSON.parse(mockResponse));

			fetch.mockRestore();
		});

		it('throws when given responses other than 200', async () => {
			const errorCodes = [400, 401, 404, 405, 429, 500];

			for (const errorCode of errorCodes) {
				fetch.mockReturnValue(Promise.resolve(new Response('', { status: errorCode })));

				const secretKey = 'invalidsecret';

				const api = new ConfigApi(secretKey, true);

				await expect(api.putTemplate()).rejects.toThrow();
			}

			fetch.mockRestore();
		});
	});

	describe('archiveTemplate method', () => {
		it('makes a request for archiving a template for a site', async () => {
			const mockResponse = '{"status": "complete"}';
			fetch.mockReturnValue(Promise.resolve(new Response(mockResponse, { status: 200 })));

			const secretKey = 'secret';

			const api = new ConfigApi(secretKey, true);

			const payload = {
				name: 'fakename',
				body: 'fakebody',
			};

			const response = await api.archiveTemplate(payload);

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch).toHaveBeenCalledWith(`${DEV_API_HOST}/api/recsTemplate`, {
				method: 'DELETE',
				body: JSON.stringify(payload),
				headers: {
					Accept: 'application/json',
					Authorization: secretKey,
					'User-Agent': '',
				},
			});

			expect(response).toStrictEqual(JSON.parse(mockResponse));

			fetch.mockRestore();
		});

		it('throws when given responses other than 200', async () => {
			const errorCodes = [400, 401, 404, 405, 409, 429, 500];

			for (const errorCode of errorCodes) {
				fetch.mockReturnValue(Promise.resolve(new Response('', { status: errorCode })));

				const secretKey = 'invalidsecret';

				const api = new ConfigApi(secretKey, true);

				await expect(api.archiveTemplate()).rejects.toThrow();
			}

			fetch.mockRestore();
		});
	});
});
