<script lang="ts">
	import { lang, ripple } from '$lib/Stores';
	import { closeModal } from 'svelte-modals';
	import Ripple from 'svelte-ripple';
	import Modal from '$lib/Modal/Index.svelte';

	export let isOpen: boolean;
	export let title: string;
	export let message: string;
	export let confirmLabel: string = '';
	export let onConfirm: () => void;

	function handleConfirm() {
		onConfirm();
		closeModal();
	}
</script>

{#if isOpen}
	<Modal backdropImage={false}>
		<h1 slot="title">{title}</h1>

		<p>{message}</p>

		<div class="actions">
			<button class="options action" on:click={closeModal} use:Ripple={$ripple}>
				{$lang('cancel')}
			</button>
			<button
				class="remove action"
				on:click={handleConfirm}
				use:Ripple={{ ...$ripple, color: 'rgba(0, 0, 0, 0.35)' }}
			>
				{confirmLabel || $lang('delete')}
			</button>
		</div>
	</Modal>
{/if}

<style>
	p {
		opacity: 0.7;
		font-size: 0.95rem;
		line-height: 1.5;
		margin: 0.5rem 0 1.5rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		padding-top: 0.5rem;
	}
</style>
