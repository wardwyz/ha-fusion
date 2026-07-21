<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
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

	export let data;
	export let params;

	// --- configuration ---
	const intervalMs = (data?.imageInterval || 30) * 1000;
	const hassUrl = data?.hassUrl || '';
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

		<!-- center: greeting -->
		<div class="center">
			<div class="greeting">{greeting}</div>
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

		.bottom-bar {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.8rem;
		}

		.notifications-section { max-width: 100%; }
	}
</style>
