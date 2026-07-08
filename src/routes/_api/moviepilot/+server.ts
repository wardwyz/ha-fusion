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
		if (mp?.server_url && mp?.token) {
			return { server_url: mp.server_url.replace(/\/$/, ''), token: mp.token };
		}
	} catch {
		// config missing or invalid
	}
	return null;
}

export const GET: RequestHandler = async () => {
	const cfg = await loadConfig();
	if (!cfg) {
		return new Response(JSON.stringify({ error: 'MoviePilot not configured' }), { status: 400 });
	}

	try {
		// Use correct endpoint: GET /api/v1/history/transfer
		const url = `${cfg.server_url}/api/v1/history/transfer?page=1&count=30&token=${encodeURIComponent(cfg.token)}`;

		const resp = await fetch(url, {
			headers: {
				'Accept': 'application/json',
				'Authorization': `Bearer ${cfg.token}`
			}
		});

		if (!resp.ok) {
			return new Response(
				JSON.stringify({ error: `MoviePilot API error: ${resp.status}` }),
				{ status: resp.status }
			);
		}

		const body = await resp.json();

		// MP wraps in {success, data, message}
		if (!body.success) {
			return new Response(
				JSON.stringify({ error: body.message ?? 'API returned failure' }),
				{ status: 500 }
			);
		}

		// data can be an array or {items, total}
		const raw = body.data ?? [];
		const records = Array.isArray(raw) ? raw : (raw.items ?? raw.list ?? []);

		// Map to normalized items
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
		return new Response(
			JSON.stringify({ error: e.message ?? 'Unknown error' }),
			{ status: 500 }
		);
	}
};
