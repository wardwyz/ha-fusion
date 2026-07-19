<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { authentication } from '$lib/Socket';
	import {
		connection,
		states,
		config,
		services,
		connected,
		persistentNotifications,
		selectedLanguage,
		timer
	} from '$lib/Stores';
	import { get } from 'svelte/store';
	import Icon from '@iconify/svelte';
	import { slide } from 'svelte/transition';

	// MA stores
	import {
		maPlayers,
		maQueues,
		connectMA,
		disconnectMA,
		callMA
	} from '$lib/MusicAssistant';
import { solarToLunar, getFestival, WEATHER_ZH } from '$lib/Lunar';

	export let data;
	export let params;

	// --- configuration ---
	const intervalMs = (data?.imageInterval || 30) * 1000;
	const hassUrl = data?.hassUrl || '';
	const maUrl = data?.maUrl || '';
	const maToken = data?.maToken || '';
	const lyricsOffset = data?.lyricsOffset ?? 0;
	$: if (data?.locale) $selectedLanguage = data.locale;

	// --- image slideshow state ---
	let images: string[] = [];
	let currentIndex = 0;
	let loaded = false;
	let slideTimer: ReturnType<typeof setInterval> | null = null;
	let transitioning = false;
	let prevIndex = -1;

	// --- WebSocket & MA connection ---
	let isConnecting = false;
	let retryInterval: ReturnType<typeof setInterval>;
	let _maConnected = false;

	async function connect() {
		if (isConnecting || !hassUrl) return;
		isConnecting = true;
		try {
			await authentication({ hassUrl });
			clearInterval(retryInterval);
		} catch {
			// will retry via interval
		} finally {
			isConnecting = false;
		}
	}

	// --- MA connection ---
	$: if (browser && maUrl && maToken && !_maConnected) {
		_maConnected = true;
		connectMA(maUrl, maToken);
	}

	// --- fetch image list ---
	async function fetchImages() {
		try {
			const res = await fetch('/api/screen-images');
			const data = await res.json();
			images = data.images || [];
			loaded = true;
			currentIndex = 0;
			startSlideshow();
		} catch {
			images = [];
			loaded = true;
		}
	}

	function startSlideshow() {
		if (slideTimer) clearInterval(slideTimer);
		if (images.length <= 1) return;
		slideTimer = setInterval(() => {
			transitioning = true;
			prevIndex = currentIndex;
			currentIndex = (currentIndex + 1) % images.length;
			setTimeout(() => {
				transitioning = false;
			}, 1000);
		}, intervalMs);
	}

	function goToMain() {
		window.location.href = '/';
	}

	// --- time/date formatting ---
	$: timeStr = $timer.toLocaleTimeString($selectedLanguage, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});

	$: dateStr = $timer.toLocaleDateString($selectedLanguage, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	// --- weather from HA ---
	$: weatherEntities = $states
		? Object.keys($states).filter((k) => k.startsWith('weather.'))
		: [];
	$: weatherEntity = weatherEntities.length > 0 ? $states?.[weatherEntities[0]] : null;
	$: weatherTemp = weatherEntity?.attributes?.temperature
		? Math.round(weatherEntity.attributes.temperature)
		: null;
	$: weatherUnit = weatherEntity?.attributes?.temperature_unit || '°';
	$: weatherCondition = weatherEntity?.state || '';

	// day/night for weather icon
	$: belowHorizon = $states?.['sun.sun']?.state === 'below_horizon';
	$: weatherIconFile = weatherCondition
		? `/weather/meteocons/${weatherCondition}-${belowHorizon ? 'night' : 'day'}.svg`
		: null;

	// --- Chinese weather & lunar calendar ---
	$: weatherConditionZh = WEATHER_ZH[weatherCondition] || weatherCondition;
	$: lunarDate = solarToLunar($timer);
	$: lunarStr = lunarDate.monthStr + '月' + lunarDate.dayStr;
	$: festivalStr = getFestival(lunarDate, $timer);

	// --- notifications ---
	$: notifications = $persistentNotifications || {};
	$: notificationEntries = Object.entries(notifications);
	$: notificationCount = notificationEntries.length;

	// --- Music Assistant state ---
	$: maPlayingPlayer = $maPlayers?.find((p) => p.playback_state === 'playing');
	$: maPlayingQueue = maPlayingPlayer ? $maQueues?.[maPlayingPlayer.player_id] : null;
	$: currentTrack = maPlayingQueue?.current_item || null;
	$: isPlaying = !!maPlayingPlayer;

	// Song info from HA media_player entities (fallback)
	$: maMediaPlayers = $states
		? Object.keys($states).filter((k) => k.startsWith('media_player.') && $states[k]?.state === 'playing')
		: [];
	$: firstPlayingMedia = maMediaPlayers.length > 0 ? $states?.[maMediaPlayers[0]] : null;
	$: songTitle = currentTrack?.name || firstPlayingMedia?.attributes?.media_title || '';
	$: songArtist = currentTrack?.artists?.[0]?.name || firstPlayingMedia?.attributes?.media_artist || '';

	// --- Lyrics state ---
	let lyrics: string[] | null = null;
	let lyricsLoading = false;
	let lyricsError = false;
	let prevTrackKey = '';

	async function fetchLyrics(trackName: string, artistName: string, uri: string) {
		// Parse track info properly
		let songName = trackName;
		let songArtist = artistName;

		if (!songArtist && trackName.includes(' - ')) {
			const parts = trackName.split(' - ');
			songArtist = parts[0].trim();
			songName = parts.slice(1).join(' - ').trim();
		}

		console.debug('[Screen] fetchLyrics:', 'title=' + songName, 'artist=' + songArtist);

		lyricsLoading = true;
		lyricsError = false;
		lyricLines = [];

		// Try public lyrics API
		try {
				const res = await fetch(
				`/api/screen-lyrics?artist=${encodeURIComponent(songArtist)}&title=${encodeURIComponent(songName)}`
			);

			if (res.ok) {
				const data = await res.json();
				if (data?.lyrics) {
					const parsed = parseLyricsToLines(data.lyrics);
					if (parsed && parsed.length > 0) {
						console.debug('[Screen] Lyrics success:', parsed.length, 'lines');
						lyricLines = parsed;
						lyricsLoading = false;
						return;
					}
				}
			}
		} catch (e) {
			console.debug('[Screen] Lyrics fetch failed:', e);
		}

		console.debug('[Screen] All lyrics sources failed');
		lyricsLoading = false;
		lyricsError = true;
	}

	interface LyricLine {
		text: string;
		time?: number;
	}

	let lyricLines: LyricLine[] = [];
	let currentLyricIndex = 0;
	let lyricTickInterval: ReturnType<typeof setInterval>;

	function parseLyricsToLines(text: string): LyricLine[] {
		if (!text) return [];
		const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
		const result: LyricLine[] = [];
		let hasTimestamps = false;

		for (const line of rawLines) {
			// Try LRC format: [mm:ss.xx]Text
			const lrcMatch = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
			if (lrcMatch) {
				const mins = parseInt(lrcMatch[1]);
				const secs = parseInt(lrcMatch[2]);
				const cs = parseInt(lrcMatch[3]);
				const time = mins * 60 + secs + cs / (lrcMatch[3].length === 2 ? 100 : 1000);
				const text = lrcMatch[4].trim();
				if (text) {
					result.push({ text, time });
					hasTimestamps = true;
				}
			} else {
				result.push({ text: line });
			}
		}

		// If we found timed lyrics, sort by time
		if (hasTimestamps) {
			result.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
		}

		return result.length > 0 ? result : text.split('\n').map(l => l.trim()).filter(Boolean).map(t => ({ text: t }));
	}

	// Update current lyric index based on playback position


	function parseLyricsResult(result: unknown): string[] | null {
		if (result == null) return null;

		// String directly — plain text or LRC
		if (typeof result === 'string') {
			const lines = result.split('\n').map((l) => l.trim()).filter(Boolean);
			return lines.length > 0 ? lines : null;
		}

		// Object result
		if (typeof result === 'object' && result !== null) {
			const obj = result as Record<string, unknown>;

			// Array of { line: string, start?: number } — timed lyrics (Apple Music / MA format)
			if (Array.isArray(obj)) {
				const lines = (obj as Array<Record<string, unknown>>)
					.map((item) => String(item.line ?? item.text ?? item.content ?? ''))
					.filter(Boolean);
				return lines.length > 0 ? lines : null;
			}

			// result.lyrics array — timed lines
			if (Array.isArray(obj.lyrics)) {
				const lines = (obj.lyrics as Array<Record<string, unknown>>)
					.map((item) => String(item.line ?? item.text ?? item.content ?? ''))
					.filter(Boolean);
				return lines.length > 0 ? lines : null;
			}

			// Plain text in various field names
			const text = String(obj.lyrics ?? obj.text ?? obj.content ?? obj.data ?? '');
			if (typeof text === 'string' && text.trim()) {
				const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
				return lines.length > 0 ? lines : null;
			}
		}

		// Array of strings directly
		if (Array.isArray(result)) {
			const lines = result.map((l) => String(l)).filter(Boolean);
			return lines.length > 0 ? lines : null;
		}

		return null;
	}

	// Reactively fetch lyrics when track changes
	$: {
		const trackKey = `${songTitle}|${songArtist}|${currentTrack?.uri || ''}`;
		if (browser && isPlaying && trackKey && trackKey !== prevTrackKey) {
			prevTrackKey = trackKey;
			fetchLyrics(songTitle, songArtist, currentTrack?.uri || '');
		} else if (!isPlaying) {
			lyrics = null;
			lyricsLoading = false;
			lyricsError = false;
			prevTrackKey = '';
		}
	}

	// --- greeting based on time ---
	$: hour = $timer.getHours();
	$: greeting =
		hour < 6 ? '夜深了' :
		hour < 12 ? '早上好' :
		hour < 14 ? '中午好' :
		hour < 18 ? '下午好' :
		'晚上好';

	onMount(() => {
		if (browser) {
			connect();
			retryInterval = setInterval(connect, 3000);
			fetchImages();
			// Lyric position tick: every second
			lyricTickInterval = setInterval(() => {
				if (lyricLines.length > 0 && lyricLines[0]?.time != null) {
					const players = get(maPlayers);
					const queues = get(maQueues);
					const p = players.find((pl) => pl.playback_state === 'playing');
					const q = p ? queues[p.player_id] : null;
					const now = Date.now() / 1000;
					const rawPos = q?.elapsed_time ?? 0;
					const lastUpdated = q?.elapsed_time_last_updated;
					const isPlaying = q?.state === 'playing';
					const drift = (lastUpdated && isPlaying) ? (now - lastUpdated) : 0;
					const pos = rawPos + drift;
					const adjustedPos = pos + lyricsOffset;
					if (adjustedPos > 0) {
						let idx = 0;
						for (let i = lyricLines.length - 1; i >= 0; i--) {
							if (lyricLines[i].time != null && lyricLines[i].time! <= adjustedPos) {
								idx = i;
								break;
							}
						}
						currentLyricIndex = idx;
					}
				}
			}, 1000);
		}
	});

	onDestroy(() => {
		if (slideTimer) clearInterval(slideTimer);
		if (lyricTickInterval) clearInterval(lyricTickInterval);
		clearInterval(retryInterval);
		if (_maConnected && maUrl) {
			disconnectMA(maUrl);
		}
	});

	$: {
		if (images.length > 0 && currentIndex < images.length) {
			const nextIdx = (currentIndex + 1) % images.length;
			const img = new Image();
			img.src = `/api/screen-images/${images[nextIdx]}`;
		}
	}
</script>

<svelte:head>
	<title>屏幕保护</title>
	<meta name="description" content="Lock Screen" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="screen" on:click={goToMain} on:keydown role="button" tabindex="0">
	<!-- background image -->
	{#if images.length > 0}
		<div class="image-container">
			{#each images as img, i}
				<img
					class="bg-image"
					class:active={i === currentIndex}
					class:prev={i === prevIndex && transitioning}
					src="/api/screen-images/{img}"
					alt=""
					draggable="false"
				/>
			{/each}
			<div class="overlay-gradient"></div>
		</div>
	{:else if loaded}
		<div class="no-image">
			<Icon icon="mdi:image-off-outline" width="64" height="64" />
			<div class="no-image-text">未找到图片</div>
		</div>
	{:else}
		<div class="loading-area">
			<div class="spinner">
				<Icon icon="mdi:loading" width="48" height="48" />
			</div>
		</div>
	{/if}

	<!-- overlay content -->
	<div class="overlay">
		<!-- top-right: time & date -->
		<div class="top-right">
			<div class="time">{timeStr}</div>
			<div class="date">{dateStr}</div>
			<div class="lunar">
				{festivalStr ? festivalStr + ' · ' : ''}{lunarStr}
				<span class="shengxiao"> ({lunarDate.shengXiao}年)</span>
			</div>
		</div>

		<!-- center: greeting / now playing / lyrics -->
		<div class="center">
			{#if isPlaying && songTitle}
				<div class="now-playing" class:has-lyrics={lyricLines.length > 0}>
					{#if lyricLines.length > 0}
						<div class="now-playing-header">
							<div class="now-playing-title">{songTitle}</div>
							<div class="now-playing-artist">{songArtist}</div>
						</div>
						<div class="lyrics-view">
							{#each lyricLines as line, i}
								{#if i >= currentLyricIndex - 2 && i <= currentLyricIndex + 2}
									<div
										class="lyric-line"
										class:current={i === currentLyricIndex}
										class:above={i === currentLyricIndex - 2}
										class:below={i === currentLyricIndex + 2}
									>
										{line.text}
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<div class="song-info">
							<div class="song-title">{songTitle}</div>
							<div class="song-artist">{songArtist}</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="greeting">{greeting}</div>
			{/if}
		</div>

		<!-- bottom bar: weather + notifications -->
		<div class="bottom-bar">
			<div class="weather-section">
				{#if weatherEntity}
					<div class="weather-icon">
						<img src={weatherIconFile} alt={weatherConditionZh} width="48" height="48" />
					</div>
					<div class="weather-info">
						<div class="weather-temp">{weatherTemp}{weatherUnit}</div>
						<div class="weather-condition">{weatherConditionZh}</div>
					</div>
				{:else}
					<div class="weather-placeholder">
						<Icon icon="mdi:weather-partly-cloudy" width="32" height="32" />
					</div>
				{/if}
			</div>

			<div class="notifications-section">
				{#if notificationCount > 0}
					<Icon icon="mdi:bell-ring" width="20" height="20" />
					<div class="notif-count">{notificationCount}</div>
					<div class="notif-preview">
						{#each notificationEntries.slice(0, 2) as [id, notif]}
							<div class="notif-item" transition:slide>
								<div class="notif-title">{notif.title || '通知'}</div>
								<div class="notif-msg">{notif.message}</div>
							</div>
						{/each}
						{#if notificationCount > 2}
							<div class="notif-more">+{notificationCount - 2} 更多</div>
						{/if}
					</div>
				{:else}
					<div class="notif-empty">
						<Icon icon="mdi:bell-outline" width="20" height="20" />
						<span>无通知</span>
					</div>
				{/if}
			</div>

			<!-- tap hint -->
			<div class="tap-hint">
				<Icon icon="mdi:hand-pointing-up" width="16" height="16" />
				<span>点击进入</span>
			</div>
		</div>
	</div>
</div>

<style>
	.screen {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		background: #000;
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
	}

	.image-container {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.bg-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 1s ease-in-out;
		pointer-events: none;
	}

	.bg-image.active {
		opacity: 1;
	}

	.bg-image.prev {
		opacity: 0;
	}

	.overlay-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(0,0,0,0.5) 0%,
			rgba(0,0,0,0.15) 30%,
			rgba(0,0,0,0.15) 60%,
			rgba(0,0,0,0.65) 100%
		);
		pointer-events: none;
	}

	.no-image, .loading-area {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #666;
		gap: 1rem;
	}

	.no-image-text {
		font-size: 1.2rem;
	}

	.spinner {
		animation: spin 1.5s linear infinite;
		display: flex;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 3rem 4rem 2.5rem;
		color: #fff;
		pointer-events: none;
	}

	/* Top-right: time & date */
	.top-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.3rem;
		text-shadow: 0 2px 12px rgba(0,0,0,0.5);
	}

	.time {
		font-size: 5rem;
		font-weight: 300;
		line-height: 1;
		letter-spacing: 0.05em;
		font-variant-numeric: tabular-nums;
	}

	.date {
		font-size: 1.3rem;
		font-weight: 400;
		opacity: 0.85;
	}

	.date::first-letter {
		text-transform: capitalize;
	}

	.lunar {
		font-size: 0.9rem;
		font-weight: 300;
		opacity: 0.65;
		margin-top: 0.2rem;
		text-shadow: 0 2px 10px rgba(0,0,0,0.4);
	}

	.lunar .shengxiao {
		opacity: 0.7;
	}

	/* Center: greeting / now playing / lyrics */
	.center {
		display: flex;
		justify-content: center;
		align-items: center;
		flex: 1;
		overflow: hidden;
	}

	.greeting {
		font-size: 2.5rem;
		font-weight: 300;
		text-shadow: 0 2px 16px rgba(0,0,0,0.4);
		opacity: 0.9;
	}

	/* Now Playing — lyrics sliding window */
	.now-playing {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-direction: column;
		width: 100%;
	}

	.now-playing.has-lyrics {
		max-height: 70vh;
	}

	/* Song info header above lyrics */
	.now-playing-header {
		text-align: center;
		margin-bottom: 0.8rem;
	}

	.now-playing-title {
		font-size: 1.1rem;
		font-weight: 500;
		text-shadow: 0 2px 12px rgba(0,0,0,0.4);
		letter-spacing: 0.04em;
	}

	.now-playing-artist {
		font-size: 0.85rem;
		font-weight: 300;
		opacity: 0.6;
		margin-top: 0.15rem;
		text-shadow: 0 2px 10px rgba(0,0,0,0.3);
	}

	/* Song info (no lyrics) — fallback */
	.song-info {
		text-align: center;
	}

	.song-title {
		font-size: 2.2rem;
		font-weight: 500;
		text-shadow: 0 2px 16px rgba(0,0,0,0.4);
		margin-bottom: 0.5rem;
		letter-spacing: 0.02em;
	}

	.song-artist {
		font-size: 1.2rem;
		font-weight: 300;
		opacity: 0.75;
		text-shadow: 0 2px 12px rgba(0,0,0,0.3);
	}

	/* Lyrics view — no background, floating text */
	.lyrics-view {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 7em;
		padding: 0 2rem;
	}

	.lyric-line {
		font-size: 1.5rem;
		font-weight: 300;
		line-height: 1.6;
		padding: 0.15rem 0;
		text-shadow: 0 2px 16px rgba(0,0,0,0.45);
		transition: all 0.5s ease;
		opacity: 0.3;
		transform: scale(0.95);
	}

	.lyric-line.current {
		opacity: 1;
		font-size: 1.8rem;
		font-weight: 400;
		transform: scale(1);
		text-shadow: 0 2px 20px rgba(0,0,0,0.5);
	}

	/* Bottom bar */
	.bottom-bar {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		text-shadow: 0 1px 8px rgba(0,0,0,0.5);
	}

	/* Weather */
	.weather-section {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.weather-icon {
		filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
		display: flex;
	}

	.weather-icon img {
		width: 48px;
		height: 48px;
	}

	.weather-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.weather-temp {
		font-size: 2rem;
		font-weight: 500;
		line-height: 1;
	}

	.weather-condition {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.weather-placeholder {
		opacity: 0.5;
	}

	/* Notifications */
	.notifications-section {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		max-width: 40%;
	}

	.notif-count {
		font-size: 1.1rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 50%;
		width: 1.8rem;
		height: 1.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.notif-preview {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		overflow: hidden;
	}

	.notif-item {
		background: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(8px);
		border-radius: 0.5rem;
		padding: 0.4rem 0.7rem;
	}

	.notif-title {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.notif-msg {
		font-size: 0.75rem;
		opacity: 0.8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.notif-more {
		font-size: 0.75rem;
		opacity: 0.7;
		font-style: italic;
	}

	.notif-empty {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		opacity: 0.5;
		font-size: 0.85rem;
	}

	.tap-hint {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		opacity: 0.4;
		transition: opacity 0.3s;
	}

	.screen:hover .tap-hint {
		opacity: 0.7;
	}

	/* Mobile/small screens */
	@media (max-width: 768px) {
		.overlay { padding: 1.5rem; }

		.time { font-size: 3.5rem; }
		.date { font-size: 1rem; }
		.greeting { font-size: 1.8rem; }

		.song-title { font-size: 1.6rem; }
		.song-artist { font-size: 1rem; }

		.lyric-line { font-size: 1.1rem; }
		.lyric-line.current { font-size: 1.35rem; }
		.lyrics-view { padding: 0 1.5rem; }

		.weather-temp { font-size: 1.5rem; }
		.weather-icon img { width: 36px; height: 36px; }
		.notifications-section { max-width: 50%; }
		.notif-msg { max-width: 120px; }
	}

	@media (max-width: 480px) {
		.overlay { padding: 1rem; }

		.time { font-size: 2.8rem; }
		.greeting { font-size: 1.4rem; }

		.song-title { font-size: 1.3rem; }
		.song-artist { font-size: 0.9rem; }

		.lyric-line { font-size: 0.9rem; }
		.lyric-line.current { font-size: 1.1rem; }
		.lyrics-view { padding: 0 1rem; }

		.bottom-bar {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.8rem;
		}

		.notifications-section { max-width: 100%; }
	}
</style>
