<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
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
	import Icon from '@iconify/svelte';
	import { slide } from 'svelte/transition';
	import { solarToLunar, getFestival, WEATHER_ZH } from '$lib/Lunar';
	import { maPlayers, maQueues, connectMA, disconnectMA, isMAConnected, imageUrl } from '$lib/MusicAssistant';

	export let data;
	export let params;

	// --- configuration ---
	const intervalMs = (data?.imageInterval || 30) * 1000;
	const hassUrl = data?.hassUrl || '';
	const token = data?.token || '';
	const maUrl = data?.maUrl || '';
	const maToken = data?.maToken || '';
	$: if (data?.locale) $selectedLanguage = data.locale;
	const dailyQuoteSensorId = data?.dailyQuoteSensor ?? '';
	let serverTimeOffset = 0;

	// Server time = client timer + offset (computed on mount)
	$: serverNow = new Date($timer.getTime() + serverTimeOffset);

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
	let lyricLines: { text: string; time?: number }[] = [];
	let lyricsLoading = false;
	let currentLyricIndex = 0;
	let lyricTickInterval: ReturnType<typeof setInterval> | null = null;
	let maReconnectInterval: ReturnType<typeof setInterval> | null = null;
	let lyricTrackKey = '';
	let lyricsEl: HTMLDivElement;

	async function connect() {
		if (isConnecting || !hassUrl) return;
		isConnecting = true;
		try {
			await authentication({ hassUrl, token });
			clearInterval(retryInterval);
		} catch {
			// will retry via interval
		} finally {
			isConnecting = false;
		}
	}

	// --- Music Assistant playback and artwork ---
	$: if (browser && maUrl && maToken && !_maConnected) {
		_maConnected = true;
		connectMA(maUrl, maToken);
	}
	$: activeQueue = Object.values($maQueues).find((queue) => queue.state === 'playing') ?? null;
	$: playingPlayer = $maPlayers.find((player) => player.playback_state === 'playing') ??
		(activeQueue ? $maPlayers.find((player) => player.player_id === activeQueue.queue_id) : null);
	$: playingQueue = activeQueue ?? (playingPlayer ? $maQueues[playingPlayer.player_id] : null);
	$: track = playingQueue?.current_item;
	$: isMusicPlaying = !!playingPlayer && !!track;
	$: trackTitle = track?.name || '';
	$: trackArtist = track?.artists?.map((artist) => artist.name).join(', ') || '';
	$: artwork = track?.image ? imageUrl(track.image, maUrl) : null;
	$: {
		const key = isMusicPlaying ? `${track?.uri || trackTitle}|${trackArtist}` : '';
		if (key !== lyricTrackKey) {
			lyricTrackKey = key;
			lyricLines = [];
			currentLyricIndex = 0;
			lastScrolledLyricIndex = -1;
			if (key) void fetchTrackLyrics(trackTitle, trackArtist, key);
		}
	}

	async function fetchTrackLyrics(title: string, artist: string, requestKey: string) {
		if (!title) return;
		lyricsLoading = true;
		try {
			const response = await fetch(`/api/screen-lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
			if (!response.ok) return;
			const result = await response.json();
			if (lyricTrackKey !== requestKey) return;
			lyricLines = parseLyrics(result?.lyrics || '');
		} catch (error) {
			console.debug('[Screen] Lyrics unavailable', error);
		} finally {
			if (lyricTrackKey === requestKey) lyricsLoading = false;
		}
	}

	function parseLyrics(input: string): { text: string; time?: number }[] {
		if (typeof input !== 'string') return [];
		const lines: { text: string; time?: number }[] = [];
		for (const raw of input.split(/\r?\n/)) {
			const line = raw.trim();
			if (!line) continue;
			const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
			const text = line.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
			if (matches.length && text) {
				for (const match of matches) {
					const fraction = match[3] || '0';
					lines.push({ text, time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${fraction}`) });
				}
			} else if (text) lines.push({ text });
		}
		return lines.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
	}

	function updateLyricPosition() {
		if (!lyricLines.length || !playingQueue) return;
		const elapsed = playingQueue.elapsed_time || 0;
		const updated = playingQueue.elapsed_time_last_updated || Date.now() / 1000;
		const position = elapsed + (playingQueue.state === 'playing' ? Math.max(0, Date.now() / 1000 - updated) : 0);
		let index = 0;
		if (lyricLines[0].time != null) {
			for (let i = 0; i < lyricLines.length; i++) {
				if (lyricLines[i].time != null && lyricLines[i].time! <= position) index = i;
			}
		} else if ((playingQueue.current_item?.duration || 0) > 0) {
			index = Math.min(lyricLines.length - 1, Math.floor((position / playingQueue.current_item!.duration) * lyricLines.length));
		}
		currentLyricIndex = index;
		if (index !== lastScrolledLyricIndex) {
			lastScrolledLyricIndex = index;
			void tick().then(() => lyricsEl?.querySelector('.lyric-line.current')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
		}
	}
	let lastScrolledLyricIndex = -1;
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
	$: timeStr = serverNow.toLocaleTimeString($selectedLanguage, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});

	$: dateStr = serverNow.toLocaleDateString($selectedLanguage, {
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
	$: dailyQuote = dailyQuoteSensorId && $states?.[dailyQuoteSensorId]?.state || '';
	$: lunarDate = solarToLunar(serverNow);
	$: lunarStr = lunarDate.monthStr + '月' + lunarDate.dayStr;
	$: festivalStr = getFestival(lunarDate, serverNow);

	// --- notifications ---
	$: notifications = $persistentNotifications || {};
	$: notificationEntries = Object.entries(notifications);
	$: notificationCount = notificationEntries.length;

	// --- Music Assistant state ---

	$: hour = serverNow.getHours();
	$: greeting =
		hour < 6 ? '夜深了' :
		hour < 12 ? '早上好' :
		hour < 14 ? '中午好' :
		hour < 18 ? '下午好' :
		'晚上好';

	onMount(() => {
		if (browser) {
			if (data?.serverTime) {
				serverTimeOffset = data.serverTime - Date.now();
			}
			connect();
			retryInterval = setInterval(connect, 3000);
			fetchImages();
			lyricTickInterval = setInterval(updateLyricPosition, 500);
			maReconnectInterval = setInterval(() => {
				if (maUrl && maToken && !isMAConnected()) {
					_maConnected = true;
					connectMA(maUrl, maToken);
				}
			}, 5000);
		}
	});

	onDestroy(() => {
		if (slideTimer) clearInterval(slideTimer);
		if (lyricTickInterval) clearInterval(lyricTickInterval);
		if (maReconnectInterval) clearInterval(maReconnectInterval);
		clearInterval(retryInterval);
		if (_maConnected && maUrl) disconnectMA(maUrl);
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

<div class="screen" class:music-active={isMusicPlaying} on:click={goToMain} on:keydown role="button" tabindex="0">
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

	<!-- full-screen weather atmosphere; the information overlay stays unobstructed -->
	{#if weatherIconFile}
		<div
			class="weather-atmosphere"
			style:background-image={`url("${weatherIconFile}")`}
			aria-hidden="true"
		></div>
	{/if}

	<!-- overlay content -->
	<div class="overlay" class:music-active={isMusicPlaying}>
		<!-- top-right: time & date -->
		<div class="top-right">
			<div class="time">{timeStr}</div>
			<div class="date">{dateStr}</div>
			<div class="lunar">
				{festivalStr ? festivalStr + ' · ' : ''}{lunarStr}
				<span class="shengxiao"> ({lunarDate.shengXiao}年)</span>
			</div>
		</div>

		<!-- center: greeting -->
		<div class="center">
			{#if isMusicPlaying}
				<div class="music-card">
					{#if artwork}
						<img class="album-art" src={artwork} alt="{trackTitle} album cover" />
					{:else}
						<div class="album-art art-placeholder"><Icon icon="mdi:music-note" width="64" height="64" /></div>
					{/if}
					<div class="music-details">
						<div class="now-playing-label">正在播放</div>
						<div class="track-title">{trackTitle}</div>
						{#if trackArtist}<div class="track-artist">{trackArtist}</div>{/if}
						<div class="lyrics-view" bind:this={lyricsEl} aria-live="polite">
							{#if lyricLines.length}
								{#each lyricLines as line, index (index)}
									<div class="lyric-line" class:current={index === currentLyricIndex}>{line.text}</div>
								{/each}
							{:else if lyricsLoading}
								<div class="lyric-empty">正在获取歌词…</div>
							{:else}
								<div class="lyric-empty">暂无歌词</div>
							{/if}
						</div>
						<div class="lyrics-progress" aria-hidden="true"><span style:width={`${lyricLines.length > 1 ? (currentLyricIndex / (lyricLines.length - 1)) * 100 : 0}%`}></span></div>
					</div>
				</div>
			{:else}
				<div class="greeting">{dailyQuote || greeting}</div>
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

	.weather-atmosphere {
		position: absolute;
		inset: -12vmax;
		background-position: center;
		background-repeat: no-repeat;
		background-size: min(110vmax, 1300px);
		opacity: 0.18;
		filter: blur(0.35rem) drop-shadow(0 0 5rem rgba(255, 255, 255, 0.25));
		mix-blend-mode: screen;
		pointer-events: none;
		animation: weather-atmosphere-drift 24s ease-in-out infinite alternate;
	}

	@keyframes weather-atmosphere-drift {
		from {
			transform: scale(1) translate3d(-1%, -1%, 0);
		}
		to {
			transform: scale(1.08) translate3d(1%, 1%, 0);
		}
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

	/* Center: greeting */
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

	.music-card {
		display: flex;
		align-items: center;
		gap: clamp(2rem, 5vw, 5rem);
		width: min(100%, 1440px);
		max-height: min(70vh, 820px);
		padding: clamp(1rem, 2vh, 1.75rem);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2rem;
		background: linear-gradient(115deg, rgba(15, 15, 18, 0.78), rgba(20, 20, 24, 0.58));
		backdrop-filter: blur(30px) saturate(1.35);
		box-shadow: 0 30px 100px rgba(0, 0, 0, 0.4);
	}

	.album-art {
		width: min(42vw, 56vh, 540px);
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: clamp(1rem, 2vw, 1.75rem);
		flex: 0 0 auto;
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
	}

	.art-placeholder {
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.12);
	}

	.music-details { min-width: 0; flex: 1; text-align: left; display: flex; flex-direction: column; max-height: min(62vh, 700px); }
	.now-playing-label { font-size: clamp(0.72rem, 1.1vw, 0.95rem); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #ff6b79; margin-bottom: 0.8rem; }
	.track-title {
		font-size: clamp(1.7rem, 3.2vw, 3.5rem);
		font-weight: 600;
		line-height: 1.15;
		text-shadow: 0 2px 14px rgba(0, 0, 0, 0.45);
	}
	.track-artist { margin-top: 0.55rem; font-size: clamp(1rem, 1.5vw, 1.4rem); opacity: 0.65; }
	.lyrics-view {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: clamp(0.7rem, 1.6vh, 1.2rem);
		min-height: 0;
		max-height: min(38vh, 380px);
		margin-top: clamp(1.5rem, 3vh, 2.5rem);
		overflow: hidden;
		mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
		 scroll-behavior: smooth;
	}
	.lyric-line {
		font-size: clamp(1.1rem, 2vw, 1.8rem);
		line-height: 1.35;
		font-weight: 600;
		color: rgba(255,255,255,0.42);
		transition: color 350ms ease, opacity 350ms ease, transform 350ms ease;
	}
	.lyric-line.current { color: #fff; opacity: 1; transform: translateX(0.35rem); }
	.lyric-empty { opacity: 0.58; font-size: 1rem; }
	.lyrics-progress { height: 3px; border-radius: 99px; overflow: hidden; margin-top: 1.3rem; background: rgba(255,255,255,0.16); }
	.lyrics-progress span { display: block; height: 100%; border-radius: inherit; background: #ff6576; transition: width 500ms ease; }
	.screen.music-active .image-container { opacity: 0.28; }

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
	/* 16:10 landscape tablets: retain the photo as the focal point while scaling the status details. */
	@media (min-width: 900px) and (max-width: 1600px) and (orientation: landscape) and (min-aspect-ratio: 8 / 5) and (max-aspect-ratio: 17 / 10) {
		.overlay {
			padding:
				clamp(1.25rem, 2.25vh, 1.8rem)
				clamp(1.75rem, 3.5vw, 3.25rem)
				clamp(1.1rem, 2vh, 1.6rem);
		}

		.time { font-size: clamp(3.5rem, 7vw, 5rem); }
		.date { font-size: clamp(1rem, 1.8vw, 1.3rem); }
		.lunar { font-size: clamp(0.8rem, 1.25vw, 0.95rem); }
		.greeting { font-size: clamp(1.75rem, 3.4vw, 2.5rem); }

		.weather-section { gap: clamp(0.55rem, 1vw, 0.8rem); }
		.weather-icon img {
			width: clamp(2.25rem, 4vw, 3rem);
			height: clamp(2.25rem, 4vw, 3rem);
		}
		.weather-temp { font-size: clamp(1.45rem, 3vw, 2rem); }
		.weather-condition { font-size: clamp(0.75rem, 1.2vw, 0.9rem); }

		.notifications-section {
			max-width: min(31vw, 25rem);
			gap: clamp(0.35rem, 0.75vw, 0.5rem);
		}
		.notif-count {
			font-size: clamp(0.9rem, 1.35vw, 1.1rem);
			width: clamp(1.55rem, 2.25vw, 1.8rem);
			height: clamp(1.55rem, 2.25vw, 1.8rem);
		}
		.notif-title { font-size: clamp(0.72rem, 1vw, 0.8rem); }
		.notif-msg {
			font-size: clamp(0.68rem, 0.95vw, 0.75rem);
			max-width: min(18vw, 13rem);
		}
		.notif-more, .notif-empty { font-size: clamp(0.68rem, 0.95vw, 0.85rem); }

		.weather-atmosphere {
			inset: -8vmax;
			background-size: clamp(32rem, 72vmax, 58rem);
			opacity: 0.12;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.weather-atmosphere, .spinner { animation: none; }
		.bg-image, .tap-hint { transition: none; }
	}

	@media (max-width: 768px) {
		.overlay { padding: 1.5rem; }
		.music-card { gap: 1rem; padding: 1rem; border-radius: 1rem; }
		.album-art { width: min(38vw, 42vh); border-radius: 0.7rem; }
		.lyrics-view { min-height: 0; max-height: 30vh; margin-top: 1rem; }

		.time { font-size: 3.5rem; }
		.date { font-size: 1rem; }
		.greeting { font-size: 1.8rem; }

		.song-title { font-size: 1.6rem; }
		.song-artist { font-size: 1rem; }

		.weather-temp { font-size: 1.5rem; }
		.weather-icon img { width: 36px; height: 36px; }
		.notifications-section { max-width: 50%; }
		.notif-msg { max-width: 120px; }
	}

	@media (max-width: 900px) and (orientation: portrait) {
		.music-card { flex-direction: column; justify-content: center; gap: 1.2rem; max-height: 74vh; overflow: hidden; }
		.album-art { width: min(56vw, 32vh); }
		.music-details { width: 100%; max-height: 34vh; }
		.now-playing-label, .track-title, .track-artist { text-align: center; }
		.now-playing-label { margin-bottom: 0.35rem; }
		.track-title { font-size: clamp(1.25rem, 4vw, 2rem); }
		.track-artist { margin-top: 0.2rem; }
		.lyrics-view { margin-top: 0.7rem; max-height: 19vh; gap: 0.55rem; text-align: center; }
		.lyric-line { font-size: clamp(1rem, 3.2vw, 1.4rem); }
		.lyrics-progress { margin-top: 0.65rem; }
	}

	@media (max-width: 480px) {
		.overlay { padding: 1rem; }
		.music-card { align-items: flex-start; gap: 0.8rem; padding: 0.8rem; }
		.album-art { width: 28vw; border-radius: 0.55rem; }
		.track-title { font-size: 1.15rem; }
		.track-artist { margin-top: 0.25rem; font-size: 0.85rem; }
		.lyrics-view { min-height: 5.5rem; max-height: 22vh; gap: 0.35rem; margin-top: 0.55rem; }
		.lyric-line { font-size: 0.9rem; }

		.time { font-size: 2.8rem; }
		.greeting { font-size: 1.4rem; }

		.song-title { font-size: 1.3rem; }
		.song-artist { font-size: 0.9rem; }

		.bottom-bar {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.8rem;
		}

		.notifications-section { max-width: 100%; }
	}

	@media (max-width: 900px) and (orientation: portrait) {
		.music-card { align-items: center; }
		.album-art { width: min(56vw, 32vh); border-radius: 0.7rem; }
		.lyrics-view { min-height: 0; max-height: 19vh; }
	}
</style>
