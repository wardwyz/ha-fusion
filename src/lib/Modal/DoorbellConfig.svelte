<script lang="ts">
	import { dashboard, lang, history, historyIndex, record, ripple, entityList } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import Select from '$lib/Components/Select.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import VisibilityItemButton from '$lib/Main/VisibilityItemButton.svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import { updateObj } from '$lib/Utils';
	import Ripple from 'svelte-ripple';
	import Camera from '$lib/Main/Camera.svelte';
	import type { DoorbellItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: DoorbellItem;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event) as DoorbellItem;
		$dashboard = $dashboard;
	}

	$: cameraOptions = $entityList('camera');
	$: allOptions = $entityList('');
	$: triggerOptions = $entityList('binary_sensor');

	function setTriggerTimeout(event: Event) {
		const v = parseInt((event.target as HTMLInputElement).value);
		set('trigger_timeout', isNaN(v) ? undefined : v);
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{$lang('doorbell') || 'Doorbell'}</h1>

		<!-- camera preview -->
		{#if sel?.camera_entity}
			<h2>{$lang('preview')}</h2>
			<Camera
				sel={{ ...sel, entity_id: sel.camera_entity }}
				responsive={true}
				muted={true}
				controls={false}
			/>
		{/if}

		<!-- camera entity -->
		<h2>{$lang('camera')}</h2>
		<Select
			computeIcons={true}
			options={cameraOptions}
			placeholder={$lang('camera')}
			value={sel?.camera_entity}
			on:change={(e) => set('camera_entity', e)}
		/>

		<!-- live stream -->
		<h2>{$lang('live')}</h2>
		<div class="button-container">
			<button class:selected={!sel?.stream} on:click={() => set('stream')} use:Ripple={$ripple}>
				{$lang('no')}
			</button>
			<button
				class:selected={sel?.stream === true}
				on:click={() => set('stream', true)}
				use:Ripple={$ripple}
			>
				{$lang('yes')}
			</button>
		</div>

		<!-- action entity -->
		<h2>{$lang('action_entity') || 'Action entity'}</h2>
		<Select
			computeIcons={true}
			options={allOptions}
			placeholder={$lang('action_entity') || 'Action entity'}
			value={sel?.action_entity}
			on:change={(e) => set('action_entity', e)}
		/>

		<!-- trigger entity -->
		<h2>{$lang('trigger_entity') || 'Trigger entity'}</h2>
		<Select
			computeIcons={true}
			options={triggerOptions}
			placeholder={$lang('trigger_entity') || 'Trigger entity'}
			value={sel?.trigger_entity}
			on:change={(e) => set('trigger_entity', e)}
		/>

		<!-- auto-close timeout -->
		{#if sel?.trigger_entity}
			<h2>{$lang('trigger_timeout')} ({$lang('seconds')?.toLowerCase()})</h2>
			<input
				class="input"
				type="number"
				min="5"
				max="300"
				placeholder="30"
				value={sel?.trigger_timeout ?? ''}
				on:change={setTriggerTimeout}
			/>
		{/if}

		<!-- visibility -->
		<h2>{$lang('visibility')}</h2>
		<div style="display: flex; gap: 0.8rem;">
			<VisibilityItemButton item={sel} />
		</div>

		<ConfigButtons {sel} />
	</Modal>
{/if}

<style>
	h2:first-letter {
		text-transform: uppercase;
	}

	.input {
		width: 100%;
		box-sizing: border-box;
	}
</style>
