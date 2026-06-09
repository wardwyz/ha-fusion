<script lang="ts">
	import Modal from '$lib/Modal/Index.svelte';
	import { states } from '$lib/Stores';
	import { getName } from '$lib/Utils';
	import Camera from '$lib/Main/Camera.svelte';

	export let sel: any;
	export let isOpen: boolean;

	// $: supported_features = attributes?.supported_features;
	// $: supports = getSupport(supported_features, {
	// 	ON_OFF: 1,
	// 	STREAM: 2
	// });
</script>

{#if isOpen}
	<Modal size="large">
		<h1 slot="title">
			{getName(sel, $states?.[sel?.entity_id])}
		</h1>

		<div class="camera-wrap">
			<Camera {sel} responsive={true} muted={false} controls={true} />
		</div>
	</Modal>
{/if}

<style>
	.camera-wrap {
		position: relative;
		border-radius: 0.5rem;
		overflow: hidden;
		flex: 1;
		min-height: 0;
		max-height: calc(85vh - 14rem);
		width: 100%;
		background: black;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1rem;
	}

	.camera-wrap :global(button) {
		width: fit-content !important;
		height: 100% !important;
		max-width: 100% !important;
		padding: 0 !important;
		border: none !important;
		background: black !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	.camera-wrap :global(video) {
		width: auto !important;
		height: 100% !important;
		max-width: 100% !important;
		object-fit: contain !important;
	}


	@media (max-width: 1024px) {
		.camera-wrap {
			max-height: calc(80vh - 12rem);
		}
	}

	/* Mobile phones */
	@media (max-width: 768px) {
		.camera-wrap {
			max-height: calc(75vh - 11rem);
		}
	}
</style>
