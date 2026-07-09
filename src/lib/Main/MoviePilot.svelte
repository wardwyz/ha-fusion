<script lang="ts">
	import { editMode, itemHeight, lang, ripple, configuration } from '$lib/Stores';
	import { onDestroy, onMount } from 'svelte';
	import { openModal } from 'svelte-modals';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { base } from '$app/paths';
	import type { MoviePilotItem, MoviePilotTransfer } from '$lib/Types';

	export let sel: MoviePilotItem;

	let items: MoviePilotTransfer[] = [];
	let current = 0;
	let timer: ReturnType<typeof setInterval> | null = null;
	let loading = true;
	let error = '';

	$: mpUrl = $configuration?.addons?.movie_pilot?.server_url ?? '';
	$: currentItem = items[current];

	$: imageUrls = items.map(item => {
		if (!item.image) return null;
		return item.image.startsWith('http')
			? item.image
			: `${mpUrl}/${item.image.replace(/^\//, '')}`;
	});

	$: typeLabel = currentItem?.type === '电影' || currentItem?.type === 'Movie'
		? '电影'
		: currentItem?.type === '电视剧' || currentItem?.type === 'TV'
			? '剧集'
			: null;

	$: ratingDisplay = currentItem?.vote_average != null
		? `★ ${currentItem.vote_average.toFixed(1)}`
		: null;

	async function fetchTransfers() {
		loading = true;
		error = '';
		try {
			const resp = await fetch(`${base}/_api/moviepilot`);
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const data = await resp.json();
			items = data?.items ?? [];
			current = 0;
		} catch (e: any) {
			error = e.message ?? 'Error';
		} finally {
			loading = false;
		}
	}

	function next() { if (items.length > 1) current = (current + 1) % items.length; }
	function prev() { if (items.length > 1) current = (current - 1 + items.length) % items.length; }

	onMount(() => {
		fetchTransfers();
		timer = setInterval(() => { if (items.length > 1) next(); }, 5000);
	});
	onDestroy(() => { if (timer) clearInterval(timer); });

	function handleClick() {
		if ($editMode) openModal(() => import('$lib/Modal/MoviePilotConfig.svelte'), { sel });
	}
</script>

<div
	class="container"
	style:min-height="{$itemHeight * 4}px"
	on:click={handleClick}
	use:Ripple={$ripple}
	role="button"
	tabindex="0"
	on:keydown
>
	{#if loading}
		<div class="state-wrap">
			<Icon icon="svg-spinners:ring-resize" height="none" />
			<p class="state-label">{$lang('loading')}</p>
		</div>
	{:else if error}
		<div class="state-wrap">
			<Icon icon="solar:shield-warning-bold-duotone" height="none" />
			<p class="state-label error">{error}</p>
		</div>
	{:else if items.length === 0}
		<div class="state-wrap">
			<Icon icon="solar:videocamera-record-bold-duotone" height="none" />
			<p class="state-label">{$lang('nothing_found')}</p>
		</div>
	{:else}
		<div class="content">
			<div class="poster-area">
				{#each items as item, i (item.tmdbid ?? i)}
					{#if imageUrls[i]}
						<img
							src={imageUrls[i]}
							alt={item.title}
							class="poster"
							class:active={i === current}
							draggable="false"
							decoding="async"
							loading="lazy"
						/>
					{/if}
				{/each}

				<div class="poster-overlay"></div>

				{#if typeLabel}
					<span class="type-badge">{typeLabel}</span>
				{/if}

				{#if ratingDisplay}
					<span class="rating-badge">{ratingDisplay}</span>
				{/if}

				{#if items.length > 1}
					<button class="arrow left" on:click|stopPropagation={prev}>
						<Icon icon="solar:alt-arrow-left-linear" height="none" />
					</button>
					<button class="arrow right" on:click|stopPropagation={next}>
						<Icon icon="solar:alt-arrow-right-linear" height="none" />
					</button>
				{/if}
			</div>

			<div class="info-area">
				<h3 class="movie-title">{currentItem?.title || '—'}</h3>
				<div class="info-meta">
					{#if currentItem?.year}
						<span class="year">
							<Icon icon="solar:calendar-linear" height="none" />
							{currentItem.year}
						</span>
					{/if}
					{#if ratingDisplay}
						<span class="year rating-star">{ratingDisplay}</span>
					{/if}
				</div>
				{#if currentItem?.overview}
					<p class="overview">{currentItem.overview}</p>
				{/if}
				<div class="counter">
					<span>#{current + 1} / {items.length}</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		background-color: var(--theme-button-background-color-off);
		font-family: inherit;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		border-radius: 0.65rem;
		overflow: hidden;
		cursor: pointer;
		border: none;
		color: inherit;
		border: 1px solid rgba(255,255,255,0.06);
		isolation: isolate;
		transition: border-color 200ms ease, box-shadow 200ms ease;
	}
	.container:hover {
		border-color: rgba(255,255,255,0.15);
		box-shadow: 0 2px 16px rgba(0,0,0,0.3);
	}

	.state-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		opacity: 0.5;
	}
	.state-wrap :global(svg) { width: 2rem; height: 2rem; }
	.state-label { font-size: 0.8rem; margin: 0; }
	.state-label.error { color: #f87171; }

	.content {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.poster-area {
		flex: 2.5;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		min-width: 0;
		background: rgba(0,0,0,0.2);
	}
	.poster {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		opacity: 0;
		transition: opacity 0.35s ease;
	}
	.poster.active { opacity: 1; }
	.poster-overlay {
		position: absolute;
		bottom: 0; left: 0; right: 0;
		height: 40%;
		background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%);
		pointer-events: none;
		z-index: 1;
	}
	.type-badge {
		position: absolute;
		top: 0.4rem; left: 0.4rem;
		z-index: 1;
		background: rgba(0,0,0,0.55);
		backdrop-filter: blur(4px);
		color: rgba(255,255,255,0.85);
		font-size: 0.65rem;
		font-weight: 500;
		padding: 0.15rem 0.45rem;
		border-radius: 0.2rem;
	}
	.rating-badge {
		position: absolute;
		top: 0.4rem; right: 0.4rem;
		z-index: 1;
		background: rgba(0,0,0,0.55);
		backdrop-filter: blur(4px);
		color: #fbbf24;
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.15rem 0.45rem;
		border-radius: 0.2rem;
	}

	.arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 1;
		background: rgba(0,0,0,0.5);
		backdrop-filter: blur(4px);
		border: none;
		color: rgba(255,255,255,0.8);
		cursor: pointer;
		width: 1.5rem; height: 1.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 150ms ease;
	}
	.content:hover .arrow { opacity: 1; }
	.arrow:hover {
		background: rgba(0,0,0,0.7);
		color: white;
	}
	.arrow :global(svg) { width: 1rem; height: 1rem; }
	.left { left: 0.3rem; }
	.right { right: 0.3rem; }

	.info-area {
		flex: 1.5;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0.6rem 0.6rem 0.6rem 0.7rem;
		min-width: 0;
		border-left: 1px solid rgba(255,255,255,0.06);
	}
	.movie-title {
		font-weight: 600;
		font-size: 0.85rem;
		line-height: 1.35;
		color: var(--theme-button-name-color-off);
		margin: 0 0 0.35rem;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.info-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-bottom: 0.3rem;
	}
	.year {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.72rem;
		opacity: 0.5;
	}
	.year :global(svg) { width: 0.85rem; height: 0.85rem; opacity: 0.6; }
	.rating-star {
		color: #fbbf24;
		opacity: 0.85;
		font-weight: 500;
	}
	.overview {
		font-size: 0.65rem;
		line-height: 1.5;
		opacity: 0.4;
		margin: 0 0 auto;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
	}
	.counter {
		font-size: 0.6rem;
		opacity: 0.25;
		text-align: right;
		margin-top: 0.2rem;
	}

	@media all and (max-width: 768px) {
		.arrow { opacity: 1; width: 1.3rem; height: 1.3rem; }
		.overview { -webkit-line-clamp: 2; }
	}
</style>
