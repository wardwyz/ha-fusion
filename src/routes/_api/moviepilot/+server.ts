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

// Cache: MP items 2h, MP media info 24h, TMDB data 24h
const CACHE_TTL = 2 * 60 * 60 * 1000;
const MEDIA_INFO_TTL = 24 * 60 * 60 * 1000;
const TMDB_CACHE_TTL = 24 * 60 * 60 * 1000;
let cache: { items: any[]; timestamp: number; hadTMDB: boolean } | null = null;
let mpMediaCache: Record<string, { data: { vote_average: number | null; vote_count: number; overview: string | null }; ts: number }> = {};
let tmdbCache: Record<string, { data: { vote_average: number | null; vote_count: number; overview: string | null }; ts: number }> = {};

/** Extract rating/overview from a generic object (flexible field names) */
function extractMediaInfo(obj: any): { vote_average: number | null; vote_count: number; overview: string | null } {
	return {
		vote_average: obj?.vote_average ?? obj?.voteAverage ?? obj?.rating ?? null,
		vote_count: obj?.vote_count ?? obj?.voteCount ?? 0,
		overview: obj?.overview ?? obj?.description ?? obj?.intro ?? null
	};
}

/** Fetch movie details from MoviePilot API first */
async function fetchMPMediaInfo(
	tmdbid: number,
	serverUrl: string,
	token: string
): Promise<{ vote_average: number | null; vote_count: number; overview: string | null } | null> {
	const ck = String(tmdbid);
	const cached = mpMediaCache[ck];
	if (cached && Date.now() - cached.ts < MEDIA_INFO_TTL) return cached.data;

	try {
		// MoviePilot media groups endpoint — returns array of media info
		const groupsUrl = `${serverUrl}/api/v1/media/groups/${tmdbid}?token=${encodeURIComponent(token)}`;
		const groupsResp = await fetch(groupsUrl, {
			headers: { 'Accept': 'application/json' },
			signal: AbortSignal.timeout(5000)
		});
		if (groupsResp.ok) {
			const groups = await groupsResp.json();
			const arr = Array.isArray(groups) ? groups : (groups?.data ?? []);
			if (Array.isArray(arr) && arr.length > 0) {
				// Find the movie entry (may be nested)
				const found = arr.find((g: any) => g?.tmdbid === tmdbid || g?.tmdb_id === tmdbid || g?.media_type === 'movie') ?? arr[0];
				const result = extractMediaInfo(found);
				if (result.vote_average != null || result.overview) {
					mpMediaCache[ck] = { data: result, ts: Date.now() };
					return result;
				}
			}
		}

		// Fallback: MoviePilot Radarr movie lookup (by TMDB id via term)
		const lookupUrl = `${serverUrl}/api/v3/movie/lookup?term=tmdb:${tmdbid}&token=${encodeURIComponent(token)}`;
		const lookupResp = await fetch(lookupUrl, {
			headers: { 'Accept': 'application/json' },
			signal: AbortSignal.timeout(5000)
		});
		if (lookupResp.ok) {
			const results = await lookupResp.json();
			const arr = Array.isArray(results) ? results : (results?.data ?? []);
			const movie = arr.find((r: any) => r?.tmdbId === tmdbid) ?? arr[0];
			if (movie) {
				const result = extractMediaInfo(movie);
				if (result.vote_average != null || result.overview) {
					mpMediaCache[ck] = { data: result, ts: Date.now() };
					return result;
				}
			}
		}
	} catch {
		// MP failed — fall through to TMDB
	}

	return null;
}

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

	const hasTMDB = !!cfg.tmdb_apikey;
	if (cache && Date.now() - cache.timestamp < CACHE_TTL && cache.hadTMDB === hasTMDB) {
		return json({ items: cache.items });
	}

	try {
		const url = `${cfg.server_url}/api/v1/history/transfer?page=1&count=100&token=${encodeURIComponent(cfg.token)}`;
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

		// Only keep movies — filter out TV shows and other media types
		const isMovie = (item: any): boolean => {
			const type = String(item.type ?? '').toLowerCase();
			const category = String(item.category ?? '').toLowerCase();
			const mediaType = String(item.media_type ?? '').toLowerCase();
			return (
				type === '电影' || type === 'movie' || type === 'film' ||
				category === 'movie' || category === '电影' ||
				mediaType === 'movie' || mediaType === 'film'
			);
		};

		const movies = records.filter(isMovie);

		// Map to normalized items, keeping any rating/overview already returned by MP
		const items = movies.map((item: any) => ({
			title: item.title ?? '',
			year: item.year ?? '',
			type: item.type ?? '',
			category: item.category ?? '',
			image: item.image ?? null,
			tmdbid: item.tmdbid ?? null,
			vote_average: item.vote_average ?? item.voteAverage ?? null as number | null,
			vote_count: item.vote_count ?? item.voteCount ?? 0,
			overview: item.overview ?? item.description ?? null as string | null
		}));

		// Enrich: MoviePilot API first, TMDB as fallback
		const enrichPromises = items.map(async (item: any) => {
			if (item.tmdbid) {
				// Already has rating/overview from transfer history — skip external calls
				if (item.vote_average != null && item.overview) return;

				// 1) MoviePilot media info
				const mpInfo = await fetchMPMediaInfo(item.tmdbid, cfg.server_url, cfg.token);
				if (mpInfo && (mpInfo.vote_average != null || mpInfo.overview)) {
					item.vote_average = mpInfo.vote_average ?? item.vote_average;
					item.vote_count = mpInfo.vote_count ?? item.vote_count;
					item.overview = mpInfo.overview ?? item.overview;
					return;
				}

				// 2) TMDB fallback
				if (cfg.tmdb_apikey) {
					const baseUrl = cfg.tmdb_api_url || 'https://api.themoviedb.org/3';
					const tmdb = await fetchTMDB(item.tmdbid, cfg.tmdb_apikey!, baseUrl);
					if (tmdb) {
						item.vote_average = tmdb.vote_average ?? item.vote_average;
						item.vote_count = tmdb.vote_count ?? item.vote_count;
						item.overview = tmdb.overview ?? item.overview;
					}
				}
			}
		});
		await Promise.allSettled(enrichPromises);

		cache = { items, timestamp: Date.now(), hadTMDB: !!cfg.tmdb_apikey };
		return json({ items });
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message ?? 'Unknown error' }), { status: 500 });
	}
};
