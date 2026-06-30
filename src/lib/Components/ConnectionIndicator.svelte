<script lang="ts">
	import { connected, motion, lang } from '$lib/Stores';
	import { fade } from 'svelte/transition';

	let hasConnectedOnce = false;
	let showBanner = false;
	let delayTimeout: ReturnType<typeof setTimeout> | undefined;

	$: if ($connected === true) {
		hasConnectedOnce = true;
		clearTimeout(delayTimeout);
		showBanner = false;
	} else if ($connected === false && hasConnectedOnce) {
		clearTimeout(delayTimeout);
		delayTimeout = setTimeout(() => {
			showBanner = true;
		}, 2000);
	}
</script>

{#if showBanner}
	<div class="banner" transition:fade={{ duration: $motion }}>
		{$lang('connection_lost')}
	</div>
{/if}

<style>
	.banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 4;
		padding: 0.5rem;
		text-align: center;
		background: rgba(174, 46, 46, 0.9);
		color: white;
		font-size: 0.9rem;
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2);
	}
</style>
