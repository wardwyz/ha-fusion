import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const artist = url.searchParams.get('artist')?.trim() ?? '';
	const title = url.searchParams.get('title')?.trim() ?? '';
	if (!title) return json({ lyrics: '' }, { status: 400 });

	const configured = process.env.SCREEN_LYRICS_API_URL?.trim();
	const apiUrl = configured
		? configured.includes('{title}')
			? configured.replaceAll('{title}', encodeURIComponent(title)).replaceAll('{artist}', encodeURIComponent(artist))
			: `${configured.replace(/\/$/, '')}?${new URLSearchParams({ title, artist })}`
		: `https://api.lrc.cx/lyrics?${new URLSearchParams({ title, artist })}`;

	try {
		const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
		if (!response.ok) return json({ lyrics: '' });
		const body = await response.text();
		let lyrics = body;
		try {
			const parsed = JSON.parse(body);
			lyrics = typeof parsed === 'string' ? parsed : parsed.lyrics ?? '';
		} catch {
			// The default lyrics service returns plain LRC text.
		}
		return json({ lyrics });
	} catch {
		return json({ lyrics: '' });
	}
};
