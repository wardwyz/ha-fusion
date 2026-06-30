<script lang="ts">
	import { connection, lang } from '$lib/Stores';
	import { callService } from 'home-assistant-js-websocket';
	import Modal from '$lib/Modal/Index.svelte';
	import Icon from '@iconify/svelte';
	import type { RemoteItem, RemoteButton } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: RemoteItem;

	function pressButton(button: RemoteButton) {
		if (!button?.entity_id || !button?.command) return;

		const data: Record<string, unknown> = {
			entity_id: button.entity_id,
			command: button.command
		};
		if (button.device) data.device = button.device;

		callService($connection, 'remote', 'send_command', data);
	}
</script>

{#if isOpen}
	<Modal size="large">
		<h1 slot="title">{sel?.name || $lang('remote')}</h1>

		<div class="grid">
			{#each sel?.buttons ?? [] as button (button.id)}
				<button class="button" on:click={() => pressButton(button)}>
					<Icon icon={button.icon || 'mdi:gesture-tap-button'} height="1.6rem" />
					<span>{button.name || button.command || $lang('remote')}</span>
				</button>
			{/each}
		</div>
	</Modal>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0.6rem;
		margin-top: 1.3rem;
	}

	.button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem 0.6rem;
		background-color: rgba(0, 0, 0, 0.2);
		border: none;
		border-radius: 0.6rem;
		color: inherit;
		font-family: inherit;
		cursor: pointer;
	}

	.button:hover {
		background-color: rgba(255, 255, 255, 0.08);
	}

	.button span {
		font-size: 0.85rem;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
</style>
