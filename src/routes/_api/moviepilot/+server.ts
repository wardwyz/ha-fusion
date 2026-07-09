import { readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';

interface MPConfig {
	server_url: string;
	token: string;
	tmdb_apikey?: string;
	tmdb_api_url?: string;
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
				tmdb_apikey: mp.tmdb_apikey,
				tmdb_api_url: mp.tmdb_api_url
			};
		}
	} catch {}
	return null;
}

// Cache: MP items 5min, TMDB data 24h
const CACHE_TTL = 2 * 60 * 60 * 1000;
const TMDB_CACHE_TTL = 24 * 60 * 60 * 1000;
let cache: { items: any[]; timestamp: number; hadTMDB: boolean } | null = null;
let tmdbCache: Record<string, { data: any; ts: number }> = {};

async function fetchTMDB(tmdbid: number, apikey: string, baseUrl?: string): Promise<{ vote_average: number | null; vote_count: number; overview: string | null } | null> {
	const ck = `${tmdbid}:${apikey}`;
	const cached = tmdbCache[ck];
	if (cached && Date.now() - cached.ts < TMDB_CACHE_TTL) return cached.data;
	try {
		
		const resp = await fetch(
			`${baseUrl}/movie/${tmdbid}?api_key=${apikey}&language=zh-CN`,
			{ signal: AbortSignal.timeout(5000) }
		);
		if (!resp.ok) return null;
		const data = await resp.json();
		const result = {
			vote_average: data.vote_average ?? null,
			vote_count: data.vote_count ?? 0,
			overview: data.overview ?? null
		};
		tmdbCache[ck] = { data: result, ts: Date.now() };
		return result;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async () => {
	const cfg = await loadConfig();
	if (!cfg) {
		return new Response(JSON.stringify({ error: 'MoviePilot not configured' }), { status: 400 });
	}

	// Return cached data if fresh
	const hasTMDB = !!cfg.tmdb_apikey;
	if (cache && Date.now() - cache.timestamp < CACHE_TTL && cache.hadTMDB === hasTMDB) {
		return json({ items: cache.items });
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
			const baseUrl = cfg.tmdb_api_url || 'https://api.themoviedb.org/3';
			const tmdbPromises = items.map(async (item: { tmdbid: number | null; vote_average: number | null; vote_count: number; overview: string | null }) => {
				if (item.tmdbid) {
					const tmdb = await fetchTMDB(item.tmdbid, cfg.tmdb_apikey!, baseUrl);
					if (tmdb) {
						item.vote_average = tmdb.vote_average;
						item.vote_count = tmdb.vote_count;
						item.overview = tmdb.overview;
					}
				}
			});
			await Promise.allSettled(tmdbPromises);
		}

		cache = { items, timestamp: Date.now(), hadTMDB: !!cfg.tmdb_apikey };
		return json({ items });
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message ?? 'Unknown error' }), { status: 500 });
	}
};
