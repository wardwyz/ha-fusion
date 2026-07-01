<script lang="ts">
	import { states, connection, lang } from '$lib/Stores';
	import { callService } from 'home-assistant-js-websocket';
	import Toggle from '$lib/Components/Toggle.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import { getName, confirmableAction } from '$lib/Utils';

	export let isOpen: boolean;
	export let sel: any;

	$: entity = $states[sel?.entity_id];
	$: toggle = entity?.state === 'on';

	/**
	 * Calls switch.toggle service, gated by sel.confirm
	 */
	function handleClick() {
		const previous = !toggle;
		confirmableAction(
			sel?.confirm,
			getName(sel, entity) || $lang('unknown'),
			() =>
				callService($connection, 'homeassistant', 'toggle', {
					entity_id: entity?.entity_id
				}),
			() => (toggle = previous)
		);
	}
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{getName(sel, entity)}</h1>

		<h2>{$lang('toggle')}</h2>

		<Toggle bind:checked={toggle} on:change={handleClick} />

		<ConfigButtons />
	</Modal>
{/if}
