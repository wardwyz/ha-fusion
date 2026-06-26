<script lang="ts">
	import { editMode, lang, ripple, configuration } from '$lib/Stores';
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
	class:has-player={!!player}
	on:click={handleClick}
	use:Ripple={$ripple}
	role="button"
	tabindex="0"
	on:keydown
>
	{#if player}
		<!-- controls -->
		<div
			class="controls"
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

		<!-- text -->
		<div class="info">
			<span class="name">{currentItem?.name ?? displayName}</span>
			<span class="state"
				>{currentItem?.artists?.[0]?.name ?? player.playback_state}</span
			>
		</div>

		<!-- art / icon -->
		<div class="art-wrap">
			{#if artSrc}
				<img class="art" src={artSrc} alt={currentItem?.name} />
			{:else}
				<div class="icon">
					<Icon icon={displayIcon} height="none" width="100%" />
				</div>
			{/if}
		</div>
	{:else}
		<!-- no player: simple layout like Button -->
		<div class="left">
			<div class="icon">
				<Icon icon={displayIcon} height="none" width="100%" />
			</div>
		</div>
		<div class="info solo">
			<span class="name">{displayName}</span>
			<span class="state">
				{#if !sel?.player_id}
					{$lang('select_player') || 'Select player'}
				{:else}
					{$lang('player_not_found') || 'Player not found'}
				{/if}
			</span>
		</div>
	{/if}
</div>

<style>
	.container {
		background-color: var(--theme-button-background-color-off);
		font-family: inherit;
		width: 100%;
		height: 100%;
		border-radius: 0.65rem;
		margin: 0;
		display: grid;
		grid-template-columns: min-content auto;
		grid-template-areas: 'left right';
		--container-padding: 0.72rem;
		transform: translateZ(0);
		overflow: hidden;
		cursor: pointer;
		border: none;
		color: inherit;
	}

	.container.has-player {
		grid-template-columns: min-content 1fr min-content;
		grid-template-areas: 'controls info art';
	}

	/* ── no-player layout ── */
	.left {
		display: flex;
		align-items: center;
		padding: var(--container-padding);
	}

	/* ── player layout ── */
	.controls {
		grid-area: controls;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.05rem;
		padding: 0.4rem 0.5rem;
	}

	.ctrl {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.1rem;
		width: 1.3rem;
		opacity: 0.55;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ctrl.main {
		width: 1.5rem;
		opacity: 0.9;
	}

	.ctrl:hover {
		opacity: 1;
	}

	/* ── text (shared) ── */
	.info {
		grid-area: info;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		padding-block: var(--container-padding);
	}

	.info.solo {
		padding-inline-end: var(--container-padding);
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

	/* ── art / icon (right column) ── */
	.art-wrap {
		grid-area: art;
		display: flex;
		align-items: center;
		padding: var(--container-padding);
	}

	.art {
		width: 2.4rem;
		height: 2.4rem;
		object-fit: cover;
		border-radius: 50%;
		flex-shrink: 0;
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
	}

	/* Phone / tablet */
	@media all and (max-width: 768px) {
		.container {
			width: calc(50vw - 1.45rem);
		}
	}
</style>
