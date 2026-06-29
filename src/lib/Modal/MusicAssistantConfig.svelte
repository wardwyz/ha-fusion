<script lang="ts">
	import { dashboard, lang, record, ripple, configuration } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { maPlayers } from '$lib/MusicAssistant';
	import type { MusicAssistantItem } from '$lib/Types';
	import { updateObj } from '$lib/Utils';

	export let isOpen: boolean;
	export let sel: MusicAssistantItem;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event) as MusicAssistantItem;
		$dashboard = $dashboard;
	}

	$: maConfigured = !!$configuration?.addons?.music_assistant?.server_url;

	function selectPlayer(id: string) {
		set('player_id', id);
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{$lang('music_assistant') || 'Music Assistant'}</h1>

		<!-- name -->
		<h2>{$lang('name')}</h2>
		<input
			class="input"
			type="text"
			value={sel?.name ?? ''}
			on:change={(e) => set('name', e)}
			autocomplete="off"
			spellcheck="false"
		/>

		{#if !maConfigured}
			<p class="notice">
				<Icon icon="mdi:information-outline" height="none" />
				{$lang('ma_configure_in_settings') || 'Configure Music Assistant in Settings → Addons'}
			</p>
		{:else if $maPlayers.length === 0}
			<p class="notice loading">
				<Icon icon="svg-spinners:ring-resize" height="none" />
				{$lang('connecting') || 'Connecting…'}
			</p>
		{:else}
			<h2>{$lang('players') || 'Players'}</h2>
			<div class="player-list">
				{#each $maPlayers as p (p.player_id)}
					<button
						class="player-option"
						class:selected={sel?.player_id === p.player_id}
						on:click={() => selectPlayer(p.player_id)}
						use:Ripple={$ripple}
					>
						<figure>
							<Icon icon="solar:music-note-2-bold-duotone" height="none" />
						</figure>
						<span class="player-name">{p.name}</span>
						{#if sel?.player_id === p.player_id}
							<figure class="check">
								<Icon icon="mdi:check" height="none" />
							</figure>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<ConfigButtons {sel} />
	</Modal>
{/if}

<style>
	.notice {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		opacity: 0.7;
		margin: 0.5rem 0 0;
		padding: 0;
	}

	.notice :global(svg) {
		width: 1.1rem;
		flex-shrink: 0;
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.player-option {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem 0.9rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background-color 120ms ease;
	}

	.player-option:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.player-option.selected {
		border-color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.1);
	}

	.player-option figure {
		width: 1.3rem;
		flex-shrink: 0;
		margin: 0;
	}

	.player-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check {
		width: 1rem;
		opacity: 0.8;
	}
</style>
