<script lang="ts">
	import { lang } from '$lib/Stores';
	import Icon from '@iconify/svelte';
	import { closeModal } from 'svelte-modals';
	import type { IframeGridItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: IframeGridItem;
</script>

{#if isOpen}
	<div class="fullscreen">
		{#if sel?.url}
			<iframe src={sel.url} title={sel?.name || $lang('iframe')} />
		{:else}
			<p class="empty-hint">{$lang('no_url') || 'No URL configured'}</p>
		{/if}

		<button
			class="exit-btn"
			on:click={closeModal}
			aria-label="exit fullscreen"
			title="exit fullscreen"
		>
			<Icon icon="mdi:close" height="none" />
		</button>
	</div>
{/if}

<style>
	iframe {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}

	.fullscreen {
		position: fixed;
		inset: 0;
		z-index: 99999;
		background: #000;
		display: flex;
	}

	.exit-btn {
		position: absolute;
		top: 25vh;
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

	.exit-btn:hover {
		background: rgba(0, 0, 0, 0.85);
	}

	.exit-btn :global(svg) {
		width: 1.3rem;
		height: 1.3rem;
	}

	.empty-hint {
		margin: auto;
		color: rgba(255, 255, 255, 0.6);
		font-size: 1rem;
	}
</style>
