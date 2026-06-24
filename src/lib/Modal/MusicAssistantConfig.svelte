<script lang="ts">
	import { dashboard, lang, record, ripple } from '$lib/Stores';
	import { closeModal } from 'svelte-modals';
	import { onDestroy } from 'svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import InputClear from '$lib/Components/InputClear.svelte';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { validateMA } from '$lib/MusicAssistant';
	import type { MAPlayer } from '$lib/MusicAssistant';
	import type { MusicAssistantItem } from '$lib/Types';
	import { updateObj } from '$lib/Utils';

	export let isOpen: boolean;
	export let sel: MusicAssistantItem;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event) as MusicAssistantItem;
		$dashboard = $dashboard;
	}

	let serverUrl: string = sel?.server_url ?? '';
	let token: string = sel?.token ?? '';
	let playerId: string | undefined = sel?.player_id;

	let connecting = false;
	let connectionStatus: 'idle' | 'ok' | 'fail' = 'idle';
	let connectionError = '';
	let availablePlayers: MAPlayer[] = [];

	async function handleConnect() {
		const trimmedUrl = serverUrl.trim();
		const trimmedToken = token.trim();
		if (!trimmedUrl || !trimmedToken) return;
		connecting = true;
		connectionStatus = 'idle';
		connectionError = '';
		try {
			availablePlayers = await validateMA(trimmedUrl, trimmedToken);
			connectionStatus = 'ok';
			set('server_url', trimmedUrl);
			set('token', trimmedToken);
		} catch (e: unknown) {
			connectionStatus = 'fail';
			connectionError = e instanceof Error ? e.message : String(e);
		} finally {
			connecting = false;
		}
	}

	function selectPlayer(id: string) {
		playerId = id;
		set('player_id', id);
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{$lang('music_assistant') || 'Music Assistant'}</h1>

		<!-- name -->
		<h2>{$lang('name')}</h2>
		<InputClear
			condition={sel?.name}
			on:clear={() => set('name')}
			let:padding
		>
			<input
				class="input"
				type="text"
				value={sel?.name ?? ''}
				on:change={(e) => set('name', e)}
				style:padding
				autocomplete="off"
				spellcheck="false"
			/>
		</InputClear>

		<!-- API token -->
		<h2>{$lang('api_token') || 'API Token'}</h2>
		<InputClear
			condition={token}
			on:clear={() => {
				token = '';
				connectionStatus = 'idle';
				availablePlayers = [];
				set('token');
			}}
			let:padding
		>
			<input
				class="input"
				type="password"
				placeholder="MA API token"
				bind:value={token}
				style:padding
				autocomplete="off"
				spellcheck="false"
				on:keydown={(e) => e.key === 'Enter' && handleConnect()}
			/>
		</InputClear>

		<!-- server URL -->
		<h2>{$lang('server_url') || 'Server URL'}</h2>
		<div class="url-row">
			<InputClear
				condition={serverUrl}
				on:clear={() => {
					serverUrl = '';
					connectionStatus = 'idle';
					availablePlayers = [];
					set('server_url');
				}}
				let:padding
			>
				<input
					class="input"
					type="url"
					placeholder="http://192.168.1.10:8095"
					bind:value={serverUrl}
					style:padding
					autocomplete="off"
					spellcheck="false"
					on:keydown={(e) => e.key === 'Enter' && handleConnect()}
				/>
			</InputClear>
			<button
				class="action"
				disabled={connecting || !serverUrl.trim() || !token.trim()}
				on:click={handleConnect}
				use:Ripple={$ripple}
			>
				{#if connecting}
					<Icon icon="svg-spinners:ring-resize" height="none" />
				{:else}
					{$lang('connect') || 'Connect'}
				{/if}
			</button>
		</div>

		{#if connectionStatus === 'ok'}
			<p class="conn-status ok">
				<Icon icon="mdi:check-circle" height="none" />
				{$lang('connected') || 'Connected'}
			</p>
		{:else if connectionStatus === 'fail'}
			<p class="conn-status fail">
				<Icon icon="mdi:alert-circle" height="none" />
				{$lang('connection_failed') || 'Connection failed'} — {connectionError}
			</p>
		{/if}

		<!-- player selector -->
		{#if availablePlayers.length > 0}
			<h2>{$lang('players') || 'Players'}</h2>
			<div class="player-list">
				{#each availablePlayers as p (p.player_id)}
					<button
						class="player-option"
						class:selected={playerId === p.player_id}
						on:click={() => selectPlayer(p.player_id)}
						use:Ripple={$ripple}
					>
						<figure>
							<Icon icon="solar:music-note-2-bold-duotone" height="none" />
						</figure>
						<span class="player-name">{p.name}</span>
						{#if playerId === p.player_id}
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
	.url-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.url-row :global(.input-clear-container) {
		flex: 1;
		min-width: 0;
	}

	.conn-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
		padding: 0;
	}

	.conn-status :global(svg) {
		width: 1.1rem;
		flex-shrink: 0;
	}

	.ok {
		color: #4caf50;
	}

	.fail {
		color: #f44336;
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
