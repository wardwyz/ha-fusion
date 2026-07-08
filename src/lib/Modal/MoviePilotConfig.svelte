<script lang="ts">
	import { dashboard, lang, record, ripple, configuration } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import type { MoviePilotItem } from '$lib/Types';
	import { updateObj } from '$lib/Utils';

	export let isOpen: boolean;
	export let sel: MoviePilotItem;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event) as MoviePilotItem;
		$dashboard = $dashboard;
	}

	$: mpConfigured = !!$configuration?.addons?.movie_pilot?.server_url;

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{$lang('movie_pilot') || 'MoviePilot'}</h1>

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

		{#if !mpConfigured}
			<p class="notice">
				{$lang('mp_configure_in_settings') || 'Configure MoviePilot in Settings → Addons'}
			</p>
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
</style>
