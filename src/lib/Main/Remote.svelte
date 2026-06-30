<script lang="ts">
	import { editMode, itemHeight, lang, ripple } from '$lib/Stores';
	import { openModal } from 'svelte-modals';
	import Icon, { loadIcon } from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import type { RemoteItem } from '$lib/Types';

	export let sel: RemoteItem;

	function handleClick() {
		if ($editMode) {
			openModal(() => import('$lib/Modal/RemoteConfig.svelte'), { sel });
		} else {
			openModal(() => import('$lib/Modal/RemoteModal.svelte'), { sel });
		}
	}
</script>

<button
	class="container"
	style:min-height="{$itemHeight}px"
	on:click={handleClick}
	use:Ripple={{ ...$ripple, color: 'rgba(255, 255, 255, 0.15)' }}
>
	<div class="icon">
		{#if sel?.icon}
			{#await loadIcon(sel.icon)}
				<Icon icon="ooui:help-ltr" height="none" width="100%" />
			{:then resolvedIcon}
				<Icon icon={resolvedIcon} height="none" width="100%" />
			{:catch}
				<Icon icon="ooui:help-ltr" height="none" width="100%" />
			{/await}
		{:else}
			<Icon icon="mdi:remote" height="none" width="100%" />
		{/if}
	</div>
	<div class="name">{sel?.name || $lang('remote')}</div>
</button>

<style>
	.container {
		background-color: var(--theme-button-background-color-off);
		font-family: inherit;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		border-radius: 0.65rem;
		margin: 0;
		padding: 0.72rem;
		border: none;
		color: inherit;
		cursor: pointer;
		text-align: left;

		/* fix ripple */
		transform: translateZ(0);
		overflow: hidden;
	}

	.icon {
		--icon-size: 2.4rem;
		height: var(--icon-size);
		width: var(--icon-size);
		color: rgb(200 200 200);
		background-color: rgba(0, 0, 0, 0.25);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		flex-shrink: 0;
	}

	.name {
		font-weight: 500;
		color: var(--theme-button-name-color-off);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.95rem;
	}
</style>
