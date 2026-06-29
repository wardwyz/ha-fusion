<script lang="ts">
	import { editMode, itemHeight, lang, ripple, configuration } from '$lib/Stores';
	import { openModal } from 'svelte-modals';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { maPlayers, maQueues, callMA, imageUrl } from '$lib/MusicAssistant';
	import type { MusicAssistantItem } from '$lib/Types';

	export let sel: MusicAssistantItem;

	$: player = $maPlayers.find((p) => p.player_id === sel?.player_id);
	$: queue = player ? $maQueues[player.player_id] : undefined;
	$: currentItem = queue?.current_item;
	$: isPlaying = queue?.state === 'playing';
	$: maServerUrl = $configuration?.addons?.music_assistant?.server_url ?? '';
	$: displayName = sel?.name || 'Music Assistant';
	$: displayIcon = sel?.icon || 'solar:music-note-2-bold-duotone';
	$: artSrc = imageUrl(currentItem?.image, maServerUrl);

	function handleClick() {
		if ($editMode) {
			openModal(() => import('$lib/Modal/MusicAssistantConfig.svelte'), { sel });
		} else {
			openModal(() => import('$lib/Modal/MusicAssistantModal.svelte'), { sel });
		}
	}

	function prevTrack() {
		const qid = queue?.queue_id ?? player?.player_id;
		if (qid) callMA('player_queues/previous', { queue_id: qid }).catch(console.error);
	}

	function playPause() {
		const qid = queue?.queue_id ?? player?.player_id;
		if (qid)
			callMA(isPlaying ? 'player_queues/pause' : 'player_queues/play', {
				queue_id: qid
			}).catch(console.error);
	}

	function nextTrack() {
		const qid = queue?.queue_id ?? player?.player_id;
		if (qid) callMA('player_queues/next', { queue_id: qid }).catch(console.error);
	}
</script>

<div
	class="container"
	style:min-height="{$itemHeight}px"
	on:click={handleClick}
	use:Ripple={$ripple}
	role="button"
	tabindex="0"
	on:keydown
>
	<!-- left: icon / album art -->
	<div class="col-icon">
		<div
			class="icon"
			style:background-image={artSrc ? `url(${artSrc})` : 'none'}
			class:has-art={!!artSrc}
		>
			{#if !artSrc}
				<Icon icon={displayIcon} height="none" width="100%" />
			{/if}
		</div>
	</div>

	<!-- center: name + state -->
	<div class="col-text">
		<span class="name">{currentItem?.name ?? displayName}</span>
		<span class="state">
			{#if !sel?.player_id}
				{$lang('select_player') || 'Select player'}
			{:else if !player}
				{$lang('player_not_found') || 'Player not found'}
			{:else}
				{currentItem?.artists?.[0]?.name ?? ($lang(player.playback_state) || player.playback_state)}
			{/if}
		</span>
	</div>

	<!-- right: controls -->
	{#if player}
		<div
			class="col-controls"
			on:click|stopPropagation
			on:keydown|stopPropagation
			role="presentation"
		>
			<button class="ctrl" on:click={prevTrack}>
				<Icon icon="solar:skip-previous-bold" height="none" />
			</button>
			<button class="ctrl main" on:click={playPause}>
				<Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} height="none" />
			</button>
			<button class="ctrl" on:click={nextTrack}>
				<Icon icon="solar:skip-next-bold" height="none" />
			</button>
		</div>
	{/if}
</div>

<style>
	.container {
		background-color: var(--theme-button-background-color-off);
		font-family: inherit;
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: min-content 1fr min-content;
		align-items: center;
		border-radius: 0.65rem;
		margin: 0;
		--container-padding: 0.72rem;
		transform: translateZ(0);
		overflow: hidden;
		cursor: pointer;
		border: none;
		color: inherit;
	}

	/* icon */
	.col-icon {
		display: flex;
		align-items: center;
		padding: var(--container-padding);
	}

	.icon {
		height: 2.4rem;
		width: 2.4rem;
		color: rgb(200 200 200);
		background-color: rgba(0, 0, 0, 0.25);
		border-radius: 50%;
		display: flex;
		align-items: center;
		padding: 0.5rem;
		flex-shrink: 0;
		background-size: cover;
		background-position: center;
	}

	.icon.has-art {
		padding: 0;
	}

	/* text */
	.col-text {
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		padding-block: var(--container-padding);
	}

	.name {
		font-weight: 500;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--theme-button-name-color-off);
		margin-top: -1px;
	}

	.state {
		font-weight: 400;
		font-size: 0.925rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--theme-button-state-color-off);
		margin-top: 1px;
	}

	/* controls */
	.col-controls {
		display: flex;
		align-items: center;
		gap: 0;
		padding-right: 0.35rem;
	}

	.ctrl {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.25rem;
		width: 1.7rem;
		height: 1.7rem;
		opacity: 0.5;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.ctrl.main {
		width: 2rem;
		height: 2rem;
		opacity: 0.85;
	}

	.ctrl:hover {
		opacity: 1;
		background-color: rgba(255, 255, 255, 0.1);
	}

	@media all and (max-width: 768px) {
		.container {
			width: calc(50vw - 1.45rem);
		}
	}
</style>
