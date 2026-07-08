import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400 });
	}

	const { server_url, token } = body;
	if (!server_url || !token) {
		return json({ success: false, error: 'Missing server_url or token' });
	}

	const url = server_url.replace(/\/$/, '');

	try {
		const resp = await fetch(
			`${url}/api/v1/history/transfer?page=1&count=1&token=${encodeURIComponent(token)}`,
			{
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${token}`
				},
				signal: AbortSignal.timeout(8000)
			}
		);

		if (!resp.ok) {
			const text = await resp.text();
			return json({ success: false, error: `HTTP ${resp.status}: ${text.slice(0, 100)}` });
		}

		const data = await resp.json();
		if (!data.success) {
			return json({ success: false, error: data.message ?? 'API returned failure' });
		}

		const records = Array.isArray(data.data)
			? data.data
			: data.data?.items ?? data.data?.list ?? [];
		return json({ success: true, count: records.length });
	} catch (e: any) {
		return json({ success: false, error: e.message ?? 'Connection failed' });
	}
};
