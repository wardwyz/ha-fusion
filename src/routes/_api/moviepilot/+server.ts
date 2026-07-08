import { readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';

interface MPConfig {
	server_url: string;
	token: string;
}

async function loadConfig(): Promise<MPConfig | null> {
	try {
		const raw = await readFile('data/configuration.yaml', 'utf8');
		const config = yaml.load(raw) as any;
		const mp = config?.addons?.movie_pilot;
		console.log('[MP proxy] config loaded:', mp ? `server=${mp.server_url}` : 'NOT FOUND');
		if (mp?.server_url && mp?.token) {
			return { server_url: mp.server_url.replace(/\/$/, ''), token: mp.token };
		}
	} catch (e: any) {
		console.error('[MP proxy] config read error:', e.message);
	}
	return null;
}

export const GET: RequestHandler = async () => {
	const cfg = await loadConfig();
	if (!cfg) {
		console.log('[MP proxy] no config → 400');
		return new Response(JSON.stringify({ error: 'MoviePilot not configured' }), { status: 400 });
	}

	try {
		const url = `${cfg.server_url}/api/v1/history/transfer?page=1&count=30&token=${encodeURIComponent(cfg.token)}`;
		console.log('[MP proxy] fetching:', url);

		const resp = await fetch(url, {
			headers: {
				'Accept': 'application/json'
			}
		});

		console.log('[MP proxy] response status:', resp.status);

		if (!resp.ok) {
			const text = await resp.text();
			console.error('[MP proxy] API error body:', text.slice(0, 200));
			return new Response(
				JSON.stringify({ error: `MoviePilot API error: ${resp.status} — ${text.slice(0, 100)}` }),
				{ status: resp.status }
			);
		}

		const body = await resp.json();
		console.log('[MP proxy] body.success:', body.success, 'data type:', Array.isArray(body.data) ? 'array' : typeof body.data);

		if (!body.success) {
			return new Response(
				JSON.stringify({ error: body.message ?? 'API returned failure' }),
				{ status: 500 }
			);
		}

		const raw = body.data ?? [];
		const records = Array.isArray(raw) ? raw : (raw.items ?? raw.list ?? []);

		console.log('[MP proxy] records count:', records.length);
		if (records.length > 0) {
			console.log('[MP proxy] first record:', JSON.stringify(records[0]).slice(0, 300));
		}

		const items = records.map((item: any) => ({
			title: item.title ?? '',
			year: item.year ?? '',
			type: item.type ?? '',
			category: item.category ?? '',
			image: item.image ?? null,
			tmdbid: item.tmdbid ?? null
		}));

		return json({ items });
	} catch (e: any) {
		console.error('[MP proxy] exception:', e.message);
		return new Response(
			JSON.stringify({ error: e.message ?? 'Unknown error' }),
			{ status: 500 }
		);
	}
};
