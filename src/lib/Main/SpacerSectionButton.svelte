<script lang="ts">
	import { dashboard, motion, lang, ripple, record } from '$lib/Stores';
	import Ripple from 'svelte-ripple';
	import { scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import type { Section } from '$lib/Types';

	export let section: Section;

	function handleClick() {
		section.spacer = section.spacer ? undefined : true;
		$dashboard = $dashboard;
		$record();
	}
</script>

<button
	title={$lang('spacer') || 'Spacer column'}
	transition:scale={{ start: 0.9, duration: $motion }}
	on:click={handleClick}
	on:pointerdown|stopPropagation
	use:Ripple={{ ...$ripple, color: 'rgba(0, 0, 0, 0.35)' }}
	style:background-color={section?.spacer ? '#ffc008' : 'var(--theme-button-background-color-off)'}
	style:color={section?.spacer ? '#3b0f0f' : 'inherit'}
	style:transition="background-color {$motion}ms ease"
>
	<div class="icon">
		<Icon icon="mdi:view-column-outline" height="none" />
	</div>
</button>

<style>
	button {
		padding: 0.4rem 0.6rem;
		font-weight: 500;
		float: right;
		font-size: 0.8rem;
		cursor: pointer;
		height: 1.8rem;
		align-items: center;
		border: inherit;
		border-radius: 0.4rem;
		display: flex;
		font-family: inherit;
		overflow: hidden;
		white-space: nowrap;
		margin-right: 0.4rem;
	}

	.icon {
		width: 1.1rem;
		height: 110%;
	}
</style>
