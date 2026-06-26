<script lang="ts">
	import { editMode, lang, ripple, configuration } from '$lib/Stores';
	import { openModal } from 'svelte-modals';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { maPlayers, imageUrl } from '$lib/MusicAssistant';
	import type { MusicAssistantItem } from '$lib/Types';

	export let sel: MusicAssistantItem;

	$: player = $maPlayers.find((p) => p.player_id === sel?.player_id);
	$: currentItem = player?.current_item;
	$: isPlaying = player?.state === 'playing';
	$: maServerUrl = $configuration?.addons?.music_assistant?.server_url ?? '';
	$: displayName = sel?.name || 'Music Assistant';
	$: displayIcon = sel?.icon || 'solar:music-note-2-bold-duotone';

	function handleClick() {
		if ($editMode) {
			openModal(() => import('$lib/Modal/MusicAssistantConfig.svelte'), { sel });
		} else {
			openModal(() => import('$lib/Modal/MusicAssistantModal.svelte'), { sel });
		}
	}
</script>

<button on:click={handleClick} use:Ripple={$ripple}>
	{#if !sel?.player_id}
		<div class="state-icon">
			<Icon icon={displayIcon} height="none" />
		</div>
		<span class="label">{displayName}</span>
		<span class="sublabel">{$lang('select_player') || 'Select player'}</span>
	{:else if !player}
		<div class="state-icon">
			<Icon icon={displayIcon} height="none" />
		</div>
		<span class="label">{displayName}</span>
		<span class="sublabel">{$lang('player_not_found') || 'Player not found'}</span>
	{:else if currentItem}
		{@const artSrc = imageUrl(currentItem.image, maServerUrl)}
		{#if artSrc}
			<img class="album-art" src={artSrc} alt={currentItem.name} />
		{:else}
			<div class="state-icon">
				<Icon icon="solar:music-note-2-bold-duotone" height="none" />
			</div>
		{/if}
		<span class="label">{currentItem.name}</span>
		<span class="sublabel">{currentItem.artists?.[0]?.name ?? ''}</span>
		<div class="play-indicator" class:playing={isPlaying}>
			<Icon icon={isPlaying ? 'solar:play-bold' : 'solar:pause-bold'} height="none" />
		</div>
	{:else}
		<div class="state-icon">
			<Icon icon={displayIcon} height="none" />
		</div>
		<span class="label">{displayName}</span>
		<span class="sublabel">{player.state}</span>
	{/if}
</button>

<style>
	button {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.8rem;
		color: inherit;
		font-family: inherit;
		position: relative;
		overflow: hidden;
		border-radius: inherit;
	}

	.state-icon {
		width: 2.5rem;
		opacity: 0.7;
	}

	.album-art {
		width: 3rem;
		height: 3rem;
		object-fit: cover;
		border-radius: 0.3rem;
		flex-shrink: 0;
	}

	.label {
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		text-align: center;
	}

	.sublabel {
		font-size: 0.7rem;
		opacity: 0.6;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		text-align: center;
	}

	.play-indicator {
		position: absolute;
		bottom: 0.4rem;
		right: 0.4rem;
		width: 1rem;
		opacity: 0.35;
	}

	.play-indicator.playing {
		opacity: 0.8;
	}
</style>
