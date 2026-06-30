<script lang="ts">
	import { lang } from '$lib/Stores';
	import Modal from '$lib/Modal/Index.svelte';
	import type { IframeGridItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: IframeGridItem;
</script>

{#if isOpen}
	<Modal size="large" fill={true}>
		<h1 slot="title">{sel?.name || $lang('iframe')}</h1>

		{#if sel?.url}
			<iframe src={sel.url} title={sel?.name || $lang('iframe')} />
		{/if}
	</Modal>
{/if}

<style>
	iframe {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0.6rem;
		display: block;
	}
</style>
