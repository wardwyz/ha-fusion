<script lang="ts">
	import { dashboard, lang, ripple, record } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import InputClear from '$lib/Components/InputClear.svelte';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { updateObj } from '$lib/Utils';
	import type { IframeGridItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: IframeGridItem;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event) as IframeGridItem;
		$dashboard = $dashboard;
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal size="large">
		<h1 slot="title">{sel?.name || $lang('iframe')}</h1>

		<h2>{$lang('name')}</h2>
		<input
			class="input"
			type="text"
			value={sel?.name ?? ''}
			placeholder={$lang('name')}
			on:input={(e) => set('name', e)}
		/>

		<h2>{$lang('icon')}</h2>
		<div class="icon-gallery-container">
			<InputClear condition={sel?.icon} on:clear={() => set('icon')} let:padding>
				<input
					class="input"
					type="text"
					placeholder={$lang('icon')}
					value={sel?.icon ?? ''}
					autocomplete="off"
					spellcheck="false"
					on:input={(e) => set('icon', e)}
					style:padding
				/>
			</InputClear>
			<button
				class="icon-gallery"
				use:Ripple={$ripple}
				title={$lang('icon')}
				on:click={() => window.open('https://icon-sets.iconify.design/', '_blank')}
			>
				<Icon icon="majesticons:open-line" height="1.2rem" />
			</button>
		</div>

		<h2>{$lang('url')}</h2>
		<input
			class="input"
			type="text"
			value={sel?.url ?? ''}
			placeholder={$lang('url')}
			autocomplete="off"
			spellcheck="false"
			on:input={(e) => set('url', e)}
		/>

		<ConfigButtons {sel} />
	</Modal>
{/if}

<style>
	.icon-gallery-container {
		display: flex;
		gap: 0.4rem;
	}

	.icon-gallery-container :global(.clear) {
		flex: 1;
	}

	.icon-gallery {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border: none;
		border-radius: 0.5rem;
		color: inherit;
		cursor: pointer;
		flex-shrink: 0;
		padding: 0.84rem;
		position: relative;
		overflow: hidden;
	}

	.icon-gallery:hover {
		background: rgba(255, 255, 255, 0.12);
	}
</style>
