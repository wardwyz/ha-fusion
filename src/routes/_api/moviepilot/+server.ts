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
		const resp = await fetch(`${cfg.server_url}/api/v1/transfer/?page=1&count=20`, {
			headers: {
				'Authorization': `Bearer ${cfg.token}`,
				'Accept': 'application/json'
			}
		});

		if (!resp.ok) {
			return new Response(
				JSON.stringify({ error: `MoviePilot API error: ${resp.status}` }),
				{ status: resp.status }
			);
		}

		const data = await resp.json();

		// Normalize transfer items: extract title, year, type, image (poster)
		const items = (data?.data?.items ?? data?.items ?? data ?? []).map((item: any) => ({
			title: item.title ?? item.name ?? '',
			year: item.year ?? '',
			type: item.type ?? item.media_type ?? '',
			image: item.image ?? item.poster ?? item.poster_path ?? null,
			state: item.state ?? '',
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
