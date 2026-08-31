<script lang="ts">
	import { lang } from '$lib/Stores';
	import Modal from '$lib/Modal/Index.svelte';
	import Icon from '@iconify/svelte';
	import type { IframeGridItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: IframeGridItem;

	let fullscreen = false;

	$: if (!isOpen && fullscreen) fullscreen = false;

	function toggleFullscreen() {
		fullscreen = !fullscreen;
	}
</script>

{#if isOpen}
	{#if fullscreen}
		<div class="fullscreen">
			{#if sel?.url}
				<iframe src={sel.url} title={sel?.name || $lang('iframe')} />
			{/if}

			<button
				class="fullscreen-close"
				on:click={() => (fullscreen = false)}
				aria-label="exit fullscreen"
			>
				<Icon icon="mdi:close" height="none" />
			</button>
		</div>
	{:else}
		<Modal size="large" fill={true}>
			<h1 slot="title">{sel?.name || $lang('iframe')}</h1>

			<button
				slot="header-actions"
				class="fullscreen-btn"
				on:click={toggleFullscreen}
				aria-label="fullscreen"
				title="fullscreen"
			>
				<Icon icon="mdi:fullscreen" height="none" />
			</button>

			{#if sel?.url}
				<iframe src={sel.url} title={sel?.name || $lang('iframe')} />
			{/if}
		</Modal>
	{/if}
{/if}

<style>
	iframe {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0.6rem;
		display: block;
	}

	.fullscreen-btn {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border-radius: 0.35rem;
		opacity: 0.7;
		transition: opacity 120ms ease, background-color 120ms ease;
	}

	.fullscreen-btn:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
	}

	.fullscreen-btn :global(svg) {
		width: 1.3rem;
		height: 1.3rem;
	}

	.fullscreen {
		position: fixed;
		inset: 0;
		z-index: 99999;
		background: #000;
		display: flex;
	}

	.fullscreen iframe {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0;
	}

	.fullscreen-close {
		position: absolute;
		top: 0.8rem;
		right: 0.8rem;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		color: white;
		cursor: pointer;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100000;
		transition: background-color 120ms ease;
	}

	.fullscreen-close:hover {
		background: rgba(0, 0, 0, 0.85);
	}

	.fullscreen-close :global(svg) {
		width: 1.3rem;
		height: 1.3rem;
	}
</style>
