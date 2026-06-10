<script lang="ts">
	import { connection, states, lang } from '$lib/Stores';
	import Modal from '$lib/Modal/Index.svelte';
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
			case 'lock': return $lang('open_door');
			case 'button':
			case 'input_button': return $lang('press');
			case 'cover': return $lang('open_cover');
			default: return $lang('open_door');
		}
	}

	function getActionIcon(): string {
		switch (actionDomain) {
			case 'lock': return 'mdi:lock-open-outline';
			case 'cover': return 'mdi:garage-open';
			default: return 'mdi:door-open';
		}
	}

	async function handleAction() {
		if (!$connection || !sel?.action_entity) return;
		const domain = actionDomain;
		if (!domain) return;

		let service: string;
		switch (domain) {
			case 'lock': service = 'unlock'; break;
			case 'button':
			case 'input_button': service = 'press'; break;
			case 'cover': service = 'open_cover'; break;
			case 'switch':
			case 'input_boolean': service = 'turn_on'; break;
			default: service = 'turn_on';
		}

		await callService($connection, domain, service, { entity_id: sel.action_entity });
	}
</script>

{#if isOpen}
	<Modal size="large">
		<svelte:fragment slot="title">
			<span class="title-row">
				<Icon icon="mdi:doorbell" height="1.1em" />
				{sel?.name || $lang('doorbell') || 'Doorbell'}
			</span>
			{#if countdown !== null}
				<span class="countdown">{countdown}s</span>
			{/if}
		</svelte:fragment>

		<div class="modal-content">
			<div class="camera-wrap">
				<Camera
					sel={{ ...sel, entity_id: sel?.camera_entity, size: 'contain' }}
					responsive={true}
					muted={false}
					controls={true}
				/>
			</div>

			{#if sel?.action_entity}
				<button class="action-btn" on:click={handleAction}>
					<Icon icon={getActionIcon()} height="1.6em" />
					{getActionLabel()}
				</button>
			{/if}
		</div>
	</Modal>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
	}

	.countdown {
		font-size: 0.85rem;
		opacity: 0.5;
		font-weight: 400;
		margin-left: auto;
		padding-right: 0.5rem;
	}

	.modal-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.camera-wrap {
		position: relative;
		border-radius: 0.5rem;
		overflow: hidden;
		height: calc(85vh - 14rem);
		min-height: 50px;
		width: 100%;
		background: black;
		display: flex;
		align-items: center;
		justify-content: center;
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

	.action-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.9rem;
		border-radius: 0.75rem;
		border: none;
		background: var(--theme-navigate-background-color, rgba(255, 255, 255, 0.15));
		color: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 150ms ease;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}

	.action-btn:hover {
		opacity: 0.8;
	}

	.action-btn:active {
		opacity: 0.6;
	}

	/* Tablet portrait (Galaxy Tab A7 Lite and similar: 800x1280) */
	@media (max-width: 1024px) {
		.camera-wrap {
			height: calc(80vh - 12rem);
		}

		.modal-content {
			gap: 0.6rem;
		}
	}

	/* Mobile phones */
	@media (max-width: 768px) {
		.camera-wrap {
			height: calc(75vh - 11rem);
		}

		.modal-content {
			gap: 0.5rem;
			padding: 0;
		}

		.action-btn {
			padding: 0.8rem;
			font-size: 0.95rem;
		}
	}
</style>
