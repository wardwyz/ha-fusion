<script lang="ts">
	import { connection, states, lang } from '$lib/Stores';
	import Camera from '$lib/Main/Camera.svelte';
	import Icon from '@iconify/svelte';
	import { callService } from 'home-assistant-js-websocket';
	import { getDomain } from '$lib/Utils';
	import { onMount, onDestroy } from 'svelte';
	import { closeModal } from 'svelte-modals';
	import type { DoorbellItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: DoorbellItem;
	export let autoClose = false;

	$: actionEntity = sel?.action_entity ? $states?.[sel.action_entity] : undefined;
	$: actionDomain = getDomain(sel?.action_entity);

	let countdown: number | null = null;
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	function startCountdown() {
		if (!sel?.trigger_timeout || sel.trigger_timeout <= 0) return;
		countdown = sel.trigger_timeout;
		countdownTimer = setInterval(() => {
			if (countdown === null) return;
			countdown--;
			if (countdown <= 0) {
				closeModal();
			}
		}, 1000);
	}

	function stopCountdown() {
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
		countdown = null;
	}

	onMount(() => {
		if (autoClose) startCountdown();
	});

	onDestroy(() => stopCountdown());

	$: if (!isOpen) stopCountdown();

	function getActionLabel(): string {
		switch (actionDomain) {
			case 'lock':
				return $lang('open_door');
			case 'button':
			case 'input_button':
				return $lang('press');
			case 'cover':
				return $lang('open_cover');
			default:
				return $lang('open_door');
		}
	}

	function getActionIcon(): string {
		switch (actionDomain) {
			case 'lock':
				return 'mdi:lock-open-outline';
			case 'cover':
				return 'mdi:garage-open';
			default:
				return 'mdi:door-open';
		}
	}

	async function handleAction() {
		if (!$connection || !sel?.action_entity) return;
		const domain = actionDomain;
		if (!domain) return;

		let service: string;
		switch (domain) {
			case 'lock':
				service = 'unlock';
				break;
			case 'button':
			case 'input_button':
				service = 'press';
				break;
			case 'cover':
				service = 'open_cover';
				break;
			case 'switch':
			case 'input_boolean':
				service = 'turn_on';
				break;
			default:
				service = 'turn_on';
		}

		await callService($connection, domain, service, { entity_id: sel.action_entity });
	}
</script>

{#if isOpen}
	<div class="doorbell-fullscreen">
		<div class="camera-wrap">
			<Camera
				sel={{ ...sel, entity_id: sel?.camera_entity, size: 'contain' }}
				responsive={true}
				muted={false}
				controls={true}
			/>
		</div>

		<div class="doorbell-top">
			<span class="title-row">
				<Icon icon="mdi:doorbell" height="1.1em" />
				{sel?.name || $lang('doorbell') || 'Doorbell'}
			</span>

			{#if countdown !== null}
				<span class="countdown">{countdown}s</span>
			{/if}
		</div>

		<button class="close-btn" on:click={closeModal} aria-label="close">
			<Icon icon="mdi:close" height="none" />
		</button>

		{#if sel?.action_entity}
			<button class="action-btn" on:click={handleAction}>
				<Icon icon={getActionIcon()} height="1.6em" />
				{getActionLabel()}
			</button>
		{/if}
	</div>
{/if}

<style>
	.doorbell-fullscreen {
		position: fixed;
		inset: 0;
		z-index: 99999;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.doorbell-top {
		position: absolute;
		top: 0.8rem;
		left: 0.8rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: white;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(6px);
		border-radius: 0.5rem;
		padding: 0.45rem 0.8rem;
		font-size: 1rem;
		font-weight: 500;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.countdown {
		font-size: 0.85rem;
		opacity: 0.85;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
	}

	.close-btn {
		position: absolute;
		top: 0.8rem;
		right: 0.8rem;
		background: rgba(0, 0, 0, 0.55);
		border: none;
		color: white;
		cursor: pointer;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100000;
		transition: background-color 120ms ease;
	}

	.close-btn:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	.close-btn :global(svg) {
		width: 1.4rem;
		height: 1.4rem;
	}

	.camera-wrap {
		position: absolute;
		inset: 0;
		background: black;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.camera-wrap :global(button) {
		width: 100%;
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
		width: 100% !important;
		height: 100% !important;
		max-width: 100% !important;
		object-fit: contain !important;
	}

	.action-btn {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		width: auto;
		min-width: 12rem;
		max-width: calc(100vw - 3rem);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.9rem 2rem;
		border-radius: 0.75rem;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(8px);
		color: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 150ms ease;
		letter-spacing: 0.02em;
		z-index: 100000;
	}

	.action-btn:hover {
		opacity: 0.8;
	}

	.action-btn:active {
		opacity: 0.6;
	}

	/* Mobile phones */
	@media (max-width: 768px) {
		.doorbell-top {
			font-size: 0.9rem;
			padding: 0.35rem 0.6rem;
		}

		.action-btn {
			padding: 0.8rem 1.4rem;
			font-size: 0.95rem;
			bottom: 1rem;
		}
	}
</style>
