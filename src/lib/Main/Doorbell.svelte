<script lang="ts">
	import { editMode, itemHeight, states } from '$lib/Stores';
	import { modals, openModal } from 'svelte-modals';
	import Loader from '$lib/Components/Loader.svelte';
	import Icon from '@iconify/svelte';
	import { getName } from '$lib/Utils';
	import type { DoorbellItem } from '$lib/Types';

	export let sel: DoorbellItem;

	let loaderVisible = true;
	let attachVideo = false;
	let stream_url: string | undefined = undefined;

	$: entity = sel?.camera_entity ? $states?.[sel.camera_entity] : undefined;
	$: frontend_stream_type = entity?.attributes?.frontend_stream_type;
	$: name = sel?.name || getName(undefined, entity) || 'Doorbell';

	$: attachVideo = !!(sel?.camera_entity && !$editMode);

	$: cameraProps = {
		entity,
		sel: { ...sel, entity_id: sel?.camera_entity, stream: sel?.stream },
		size: 'cover',
		responsive: true,
		muted: true
	};

	function handleClick() {
		if ($editMode) {
			openModal(() => import('$lib/Modal/DoorbellConfig.svelte'), { sel });
		} else {
			openModal(() => import('$lib/Modal/DoorbellModal.svelte'), { sel });
		}
	}
</script>

<button
	style:height="calc({$itemHeight}px * 4 + 0.4rem * 3)"
	style:width="calc(14.5rem * 2 + 0.4rem)"
	on:click={handleClick}
>
	{#if sel?.camera_entity}
		{#if loaderVisible && !$editMode}
			<div class="loader">
				<div><Loader /></div>
			</div>
		{/if}

		{#if frontend_stream_type === 'hls'}
			{#await import('$lib/Main/Camera/HLS.svelte') then HLS}
				<svelte:component
					this={HLS.default}
					bind:stream_url
					bind:loaderVisible
					{...cameraProps}
					{attachVideo}
					controls={false}
					debug={false}
				/>
			{/await}
		{:else if frontend_stream_type === 'web_rtc'}
			{#await import('$lib/Main/Camera/WebRTC.svelte') then WebRTC}
				<svelte:component
					this={WebRTC.default}
					bind:stream_url
					bind:loaderVisible
					{...cameraProps}
					{attachVideo}
					controls={false}
					debug={false}
				/>
			{/await}
		{/if}

		{#await import('$lib/Main/Camera/Proxy.svelte') then Proxy}
			<svelte:component this={Proxy.default} bind:loaderVisible {...cameraProps} {stream_url} />
		{/await}
	{:else}
		<div class="placeholder">
			<Icon icon="mdi:doorbell" height="3rem" opacity="0.4" />
		</div>
	{/if}

	<!-- overlay -->
	<div class="overlay" style:display={$modals?.length > 0 ? 'none' : ''}>
		<div class="icon-wrap">
			<Icon icon="mdi:doorbell" height="1.5rem" />
		</div>
		<span class="name">{name}</span>
	</div>
</button>

<style>
	button {
		all: unset;
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 0.6rem;
		position: relative;
		color: white;
		overflow: hidden;
		display: grid;
		box-sizing: border-box;
		cursor: pointer;
		--container-padding: 0.8rem;
	}

	.loader {
		aspect-ratio: 16/9;
	}

	.loader > div {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: scale(0.5);
		z-index: 1;
		pointer-events: none;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.8rem;
		background: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(0.6rem);
		-webkit-backdrop-filter: blur(0.6rem);
		z-index: 2;
	}

	.icon-wrap {
		flex-shrink: 0;
		opacity: 0.85;
	}

	.name {
		font-size: 0.95rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--theme-button-name-color-off, white);
	}
</style>
