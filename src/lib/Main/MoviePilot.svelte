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

	$: displayName = sel?.name || 'MoviePilot';
	$: mpUrl = $configuration?.addons?.movie_pilot?.server_url ?? '';

	async function fetchTransfers() {
		loading = true;
		error = '';
		try {
			const resp = await fetch(`${base}/_api/moviepilot`);
			if (!resp.ok) {
				const j = await resp.json().catch(() => ({}));
				throw new Error(j.error ?? `HTTP ${resp.status}`);
			}
			const data = await resp.json();
			items = data?.items ?? [];
			current = 0;
		} catch (e: any) {
			error = e.message ?? 'Error';
		} finally {
			loading = false;
		}
	}

	function next() {
		if (items.length <= 1) return;
		current = (current + 1) % items.length;
	}

	function prev() {
		if (items.length <= 1) return;
		current = (current - 1 + items.length) % items.length;
	}

	onMount(() => {
		fetchTransfers();
		timer = setInterval(() => {
			if (items.length > 1) next();
		}, 5000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	function handleClick() {
		if ($editMode) {
			openModal(() => import('$lib/Modal/MoviePilotConfig.svelte'), { sel });
		}
	}

	$: currentItem = items[current];
	$: typeLabel = currentItem?.type === '电影' || currentItem?.type === 'Movie'
		? ($lang('movie') || 'Movie')
		: currentItem?.type === '电视剧' || currentItem?.type === 'TV' || currentItem?.type === 'Series'
			? ($lang('tv_show') || 'TV')
			: '';
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
			<span class="state-text">{$lang('loading')}</span>
		</div>
	{:else if error}
		<div class="state-wrap">
			<Icon icon="solar:shield-warning-bold-duotone" height="none" />
			<span class="state-text">{error}</span>
		</div>
	{:else if items.length === 0}
		<div class="state-wrap">
			<Icon icon="solar:videocamera-record-bold-duotone" height="none" />
			<span class="state-text">{$lang('nothing_found')}</span>
		</div>
	{:else}
		<!-- cover carousel -->
		<div class="carousel">
			<!-- left arrow -->
			<button
				class="arrow left"
				on:click|stopPropagation={prev}
				disabled={items.length <= 1}
			>
				<Icon icon="solar:alt-arrow-left-linear" height="none" />
			</button>

			<!-- cover image -->
			<div class="cover-area">
				{#if currentItem?.image}
					{@const imgSrc = currentItem.image.startsWith('http')
						? currentItem.image
						: `${mpUrl}/${currentItem.image.replace(/^\//, '')}`}
					<img
						src={imgSrc}
						alt={currentItem.title}
						class="cover"
						draggable="false"
					/>
				{/if}
			</div>

			<!-- right arrow -->
			<button
				class="arrow right"
				on:click|stopPropagation={next}
				disabled={items.length <= 1}
			>
				<Icon icon="solar:alt-arrow-right-linear" height="none" />
			</button>
		</div>

		<!-- info bar -->
		<div class="info">
			<span class="title">{currentItem.title}</span>
			<span class="meta">
				{#if currentItem.year}{currentItem.year}{/if}
				{#if typeLabel} · {typeLabel}{/if}
			</span>
		</div>

		<!-- dots -->
		{#if items.length > 1}
			<div class="dots">
				{#each items as _, i}
					<button
						class="dot"
						class:active={i === current}
						on:click|stopPropagation={() => { current = i; }}
					/>
				{/each}
			</div>
		{/if}
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
		position: relative;
	}

	/* loading / error / empty states */
	.state-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 0.5rem;
		opacity: 0.5;
	}

	.state-wrap :global(svg) {
		width: 2rem;
		height: 2rem;
	}

	.state-text {
		font-size: 0.8rem;
	}



	/* carousel */
	.carousel {
		flex: 1;
		display: flex;
		align-items: center;
		min-height: 0;
		position: relative;
	}

	.arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 2;
		background: rgba(0, 0, 0, 0.45);
		border: none;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		padding: 0.3rem;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 150ms ease;
	}

	.arrow:disabled {
		display: none;
	}

	.container:hover .arrow {
		opacity: 1;
	}

	.arrow:hover {
		background: rgba(0, 0, 0, 0.7);
		color: white;
	}

	.arrow :global(svg) {
		width: 1.2rem;
		height: 1.2rem;
	}

	.left { left: 0.4rem; }
	.right { right: 0.4rem; }

	.cover-area {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		overflow: hidden;
		padding: 0.4rem;
	}

	.cover {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border-radius: 0.35rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		display: block;
	}

	/* info bar */
	.info {
		padding: 0.35rem 0.7rem 0.25rem;
		display: flex;
		flex-direction: column;
		text-align: center;
	}

	.title {
		font-weight: 500;
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--theme-button-name-color-off);
	}

	.meta {
		font-size: 0.75rem;
		opacity: 0.5;
		margin-top: 1px;
	}

	/* dots */
	.dots {
		display: flex;
		justify-content: center;
		gap: 0.3rem;
		padding: 0.25rem 0 0.5rem;
	}

	.dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		cursor: pointer;
		padding: 0;
		transition: background 150ms ease;
	}

	.dot.active {
		background: rgba(255, 255, 255, 0.7);
	}

	.dot:hover {
		background: rgba(255, 255, 255, 0.5);
	}

	@media all and (max-width: 768px) {
		.arrow {
			opacity: 1;
			width: 1.3rem;
			height: 1.3rem;
		}
	}
</style>
