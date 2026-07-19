import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/screen-lyrics?artist=...&title=...
// Proxies to public lyrics APIs
export const GET: RequestHandler = async ({ url }) => {
	const artist = url.searchParams.get('artist') || '';
	const title = url.searchParams.get('title') || '';

	let cleanArtist = artist.trim();
	let cleanTitle = title.trim();

	if (!cleanArtist && cleanTitle.includes(' - ')) {
		const parts = cleanTitle.split(' - ');
		cleanArtist = parts[0].trim();
		cleanTitle = parts.slice(1).join(' - ').trim();
	}

	if (!cleanTitle) {
		return json({ lyrics: null });
	}

	const encArtist = encodeURIComponent(cleanArtist);
	const encTitle = encodeURIComponent(cleanTitle);
	const customApiUrl = process.env.SCREEN_LYRICS_API_URL || '';

	async function fetchWithTimeout(resource: string, options: Record<string, any> = {}) {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), 8000);
		try {
			return await fetch(resource, { ...options, signal: controller.signal });
		} finally {
			clearTimeout(id);
		}
	}

	// Helper: extract lyrics text from various response formats
	async function extractLyrics(res: Response): Promise<string | null> {
		const raw = await res.text();
		if (!raw || !raw.trim()) return null;
		// Try JSON
		try {
			const json = JSON.parse(raw);
			const lyric = json?.lrc || json?.lyric || json?.lyrics || json?.text || json?.data || json?.result || '';
			if (typeof lyric === 'string' && lyric.trim()) return lyric;
			// Maybe the result is nested
			if (typeof json?.result === 'object' && json.result) {
				const r = json.result;
				const nested = r?.lrc || r?.lyric || r?.lyrics || r?.text || '';
				if (typeof nested === 'string' && nested.trim()) return nested;
			}
			return null;
		} catch {
			// Not JSON — raw text (LRC, plain, etc.)
			return raw.trim() || null;
		}
	}

	const sources = [
		// 1) Custom API if configured
		...(customApiUrl
			? [
				async () => {
					const url = customApiUrl.replace('{artist}', encArtist).replace('{title}', encTitle);
					const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'ha-fusion/1.0' } });
					if (!res.ok) return null;
					return extractLyrics(res);
				}
			]
			: []),
		// 2) api.lrc.cx — excellent for Chinese songs
		async () => {
			const res = await fetchWithTimeout(
				`https://api.lrc.cx/lyrics?artist=${encArtist}&title=${encTitle}`,
				{ headers: { 'User-Agent': 'ha-fusion/1.0' } }
			);
			if (!res.ok) return null;
			return extractLyrics(res);
		},
		// 3) lrclib.net get
		async () => {
			const res = await fetchWithTimeout(
				`https://lrclib.net/api/get?artist_name=${encArtist}&track_name=${encTitle}`,
				{ headers: { 'User-Agent': 'ha-fusion/1.0' } }
			);
			if (res.status === 404) return null;
			if (!res.ok) return null;
			return extractLyrics(res);
		},
		// 4) lyrics.ovh
		async () => {
			const res = await fetchWithTimeout(`https://api.lyrics.ovh/v1/${encArtist}/${encTitle}`);
			if (!res.ok) return null;
			return extractLyrics(res);
		},
		// 5) lrclib search — artist + title
		async () => {
			const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
			const res = await fetchWithTimeout(
				`https://lrclib.net/api/search?q=${query}`,
				{ headers: { 'User-Agent': 'ha-fusion/1.0' } }
			);
			if (!res.ok) return null;
			return extractLyrics(res);
		},
		// 6) lrclib search — just title
		async () => {
			const query = encodeURIComponent(cleanTitle);
			const res = await fetchWithTimeout(
				`https://lrclib.net/api/search?q=${query}`,
				{ headers: { 'User-Agent': 'ha-fusion/1.0' } }
			);
			if (!res.ok) return null;
			return extractLyrics(res);
		}
	];

	for (const source of sources) {
		try {
			const result = await source();
			if (result) {
				return json({ lyrics: result, source: 'public' });
			}
		} catch {
			// try next
		}
	}

	return json({ lyrics: null });
};
