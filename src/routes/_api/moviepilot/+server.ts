import { readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';

interface MPConfig {
	server_url: string;
	token: string;
	tmdb_apikey?: string;
}

async function loadConfig(): Promise<MPConfig | null> {
	try {
		const raw = await readFile('data/configuration.yaml', 'utf8');
		const config = yaml.load(raw) as any;
		const mp = config?.addons?.movie_pilot;
		if (mp?.server_url && mp?.token) {
			return {
				server_url: mp.server_url.replace(/\/$/, ''),
				token: mp.token,
				tmdb_apikey: mp.tmdb_apikey
			};
		}
	} catch {}
	return null;
}

async function fetchTMDB(tmdbid: number, apikey: string): Promise<{ vote_average: number | null; vote_count: number; overview: string | null } | null> {
	try {
		const resp = await fetch(
			`https://api.themoviedb.org/3/movie/${tmdbid}?api_key=${apikey}&language=zh-CN`,
			{ signal: AbortSignal.timeout(5000) }
		);
		if (!resp.ok) return null;
		const data = await resp.json();
		return {
			vote_average: data.vote_average ?? null,
			vote_count: data.vote_count ?? 0,
			overview: data.overview ?? null
		};
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async () => {
	const cfg = await loadConfig();
	if (!cfg) {
		return new Response(JSON.stringify({ error: 'MoviePilot not configured' }), { status: 400 });
	}

	try {
		const url = `${cfg.server_url}/api/v1/history/transfer?page=1&count=30&token=${encodeURIComponent(cfg.token)}`;
		const resp = await fetch(url, {
			headers: { 'Accept': 'application/json' }
		});

		if (!resp.ok) {
			return new Response(JSON.stringify({ error: `MoviePilot API error: ${resp.status}` }), { status: resp.status });
		}

		const body = await resp.json();
		if (!body.success) {
			return new Response(JSON.stringify({ error: body.message ?? 'API returned failure' }), { status: 500 });
		}

		const raw = body.data ?? [];
		const records = Array.isArray(raw) ? raw : (raw.items ?? raw.list ?? []);

		// Map to normalized items
		const items = records.map((item: any) => ({
			title: item.title ?? '',
			year: item.year ?? '',
			type: item.type ?? '',
			category: item.category ?? '',
			image: item.image ?? null,
			tmdbid: item.tmdbid ?? null,
			vote_average: null as number | null,
			vote_count: 0,
			overview: null as string | null
		}));

		// Enrich with TMDB data if key is configured
		if (cfg.tmdb_apikey) {
			const tmdbPromises = items.map(async (item) => {
				if (item.tmdbid) {
					const tmdb = await fetchTMDB(item.tmdbid, cfg.tmdb_apikey!);
					if (tmdb) {
						item.vote_average = tmdb.vote_average;
						item.vote_count = tmdb.vote_count;
						item.overview = tmdb.overview;
					}
				}
			});
			await Promise.allSettled(tmdbPromises);
		}

		return json({ items });
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message ?? 'Unknown error' }), { status: 500 });
	}
};
