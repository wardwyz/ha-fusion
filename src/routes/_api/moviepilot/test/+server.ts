import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400 });
	}

	const { server_url, token, tmdb_apikey, tmdb_api_url } = body;
	if (!server_url || !token) {
		return json({ success: false, error: 'Missing server_url or token' });
	}

	const url = server_url.replace(/\/$/, '');
	const result: any = { mp: null, tmdb: null };

	// Test MP
	try {
		const resp = await fetch(
			`${url}/api/v1/history/transfer?page=1&count=1&token=${encodeURIComponent(token)}`,
			{ headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
		);
		if (resp.ok) {
			const data = await resp.json();
			if (data.success) {
				const records = Array.isArray(data.data) ? data.data : data.data?.items ?? data.data?.list ?? [];
				result.mp = { ok: true, msg: `✓ ${records.length} records` };
			} else {
				result.mp = { ok: false, msg: data.message ?? 'API failure' };
			}
		} else {
			result.mp = { ok: false, msg: `HTTP ${resp.status}` };
		}
	} catch (e: any) {
		result.mp = { ok: false, msg: e.message ?? 'Connection failed' };
	}

	// Test TMDB
	if (tmdb_apikey) {
		try {
			const base = (tmdb_api_url || 'https://api.themoviedb.org/3').replace(/\/$/, '');
			const resp = await fetch(
				`${base}/movie/550?api_key=${tmdb_apikey}&language=zh-CN`,
				{ signal: AbortSignal.timeout(8000) }
			);
			if (resp.ok) {
				const data = await resp.json();
				if (data.title) {
					result.tmdb = { ok: true, msg: `✓ ${data.title} (★${data.vote_average ?? '?'})` };
				} else {
					result.tmdb = { ok: false, msg: 'Invalid response' };
				}
			} else {
				const text = await resp.text();
				result.tmdb = { ok: false, msg: `HTTP ${resp.status}: ${text.slice(0, 80)}` };
			}
		} catch (e: any) {
			result.tmdb = { ok: false, msg: e.message ?? 'Connection failed' };
		}
	}

	return json(result);
};
