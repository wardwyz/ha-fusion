<script lang="ts">
	import { dashboard, record, lang, ripple } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import Icon from '@iconify/svelte';
	import InputClear from '$lib/Components/InputClear.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Ripple from 'svelte-ripple';
	import { updateObj } from '$lib/Utils';
	import type { ViewItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: ViewItem;

	let name = sel?.name;
	let icon: string | undefined = sel?.icon;
	let is_default: boolean = !!sel?.is_default;
	let default_timeout: number | undefined = sel?.default_timeout;
	let iframe_url: string | undefined = sel?.iframe_url;

	const nameConst = name;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event);
		$dashboard = $dashboard;
	}

	function toggleDefault() {
		is_default = !is_default;
		if (is_default) {
			$dashboard.views.forEach((v) => {
				if (v.id !== sel.id) {
					delete v.is_default;
					delete v.default_timeout;
				}
			});
			sel = updateObj(sel, 'is_default', true);
			if (!default_timeout) {
				default_timeout = 30;
				sel = updateObj(sel, 'default_timeout', 30);
			}
		} else {
			sel = updateObj(sel, 'is_default');
			sel = updateObj(sel, 'default_timeout');
			default_timeout = undefined;
		}
		$dashboard = $dashboard;
	}

	function setDefaultTimeout(event: Event) {
		const val = parseInt((event.target as HTMLInputElement).value);
		default_timeout = val > 0 ? val : undefined;
		sel = default_timeout
			? updateObj(sel, 'default_timeout', default_timeout)
			: updateObj(sel, 'default_timeout');
		$dashboard = $dashboard;
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{$lang('edit_view')}</h1>

		<h2>{$lang('preview')}</h2>

		<div class="preview">
			<div class="inline-preview">
				<div class="view_item">{name || nameConst}</div>
			</div>
		</div>

		<h2>{$lang('name')}</h2>

		<InputClear
			condition={name}
			on:clear={() => {
				name = '';
				set('name', nameConst);
			}}
			let:padding
		>
			<input
				class="input"
				type="text"
				bind:value={name}
				placeholder={nameConst}
				on:change={(event) => set('name', event)}
				style:padding
				autocomplete="off"
				spellcheck="false"
			/>
		</InputClear>

		<h2>{$lang('icon')} ({$lang('sidebar')?.toLocaleLowerCase()})</h2>

		<div class="icon-gallery-container">
			<InputClear
				condition={icon}
				on:clear={() => {
					icon = undefined;
					set('icon');
				}}
				let:padding
			>
				<input
					class="input"
					type="text"
					placeholder="fluent:tab-add-24-filled"
					bind:value={icon}
					on:change={(event) => set('icon', event)}
					style:padding
					autocomplete="off"
					spellcheck="false"
				/>
			</InputClear>

			<button
				class="icon-gallery"
				on:click={() => {
					window.open('https://icon-sets.iconify.design/', '_blank');
				}}
				title={$lang('icon')}
				use:Ripple={$ripple}
			>
				<Icon icon="vaadin:grid-small" height="none" />
			</button>
		</div>

		<h2>{$lang('default_view')}</h2>

		<div class="button-container">
			<button
				class:selected={!is_default}
				on:click={() => is_default && toggleDefault()}
				use:Ripple={$ripple}
			>
				{$lang('no')}
			</button>
			<button
				class:selected={is_default}
				on:click={() => !is_default && toggleDefault()}
				use:Ripple={$ripple}
			>
				{$lang('yes')}
			</button>
		</div>

		{#if is_default}
			<h2>{$lang('return_after')} ({$lang('seconds')?.toLowerCase()})</h2>

			<input
				class="input"
				type="number"
				min="5"
				step="5"
				placeholder="30"
				value={default_timeout ?? ''}
				on:change={setDefaultTimeout}
			/>
		{/if}

		<h2>{$lang('iframe_url')}</h2>

		<InputClear
			condition={iframe_url}
			on:clear={() => {
				iframe_url = undefined;
				set('iframe_url');
			}}
			let:padding
		>
			<input
				class="input"
				type="url"
				placeholder="https://..."
				bind:value={iframe_url}
				on:change={(event) => set('iframe_url', event)}
				style:padding
				autocomplete="off"
				spellcheck="false"
			/>
		</InputClear>

		<ConfigButtons {sel} />
	</Modal>
{/if}

<style>
	.inline-preview {
		width: fit-content;
		padding: 0.6rem 0;
	}

	.view_item {
		border-bottom: 3px solid white;
		color: white;
		font-weight: 700;
		font-size: 1.2rem;
		padding-bottom: 3px;
		white-space: nowrap;
	}
</style>
