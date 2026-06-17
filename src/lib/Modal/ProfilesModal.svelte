<script lang="ts">
	import { lang, motion, autocompleteList } from '$lib/Stores';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { closeModal } from 'svelte-modals';
	import { fade } from 'svelte/transition';
	import Modal from '$lib/Modal/Index.svelte';
	import CodeEditor from '$lib/Components/CodeEditor.svelte';

	export let isOpen: boolean;

	const EMPTY_DASHBOARD = 'views: []\nsidebar: []\n';

	let name = '';
	let content = EMPTY_DASHBOARD;
	let nameError = '';
	let transitionend = false;

	$: nameValid = name.trim().length > 0;

	async function create() {
		const trimmed = name.trim();
		if (!trimmed) return;

		nameError = '';

		const response = await fetch(`${base}/_api/create_profile`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: trimmed, content })
		});

		if (response.ok) {
			closeModal();
			goto(`${base}/${trimmed}`);
		} else {
			const data = await response.json();
			nameError = $lang(data.message) || data.message;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			if (nameValid) create();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
	<Modal size="large" on:transitionend={() => (transitionend = true)}>
		<h1 slot="title">{$lang('new_profile')}</h1>

		<h2>{$lang('profile_name')}</h2>

		<input
			class="input"
			type="text"
			placeholder={$lang('profile_name')}
			bind:value={name}
			on:keydown={(e) => e.key === 'Enter' && nameValid && create()}
		/>

		{#if nameError}
			<p class="error" transition:fade={{ duration: $motion }}>{nameError}</p>
		{/if}

		<br />

		<CodeEditor
			value={content}
			type="yaml"
			init={content}
			{transitionend}
			autocompleteList={$autocompleteList}
			on:change={(event) => (content = event.detail)}
		/>

		<div class="footer">
			<button class="options action" on:click={closeModal}>{$lang('cancel')}</button>

			<button class="done action" disabled={!nameValid} on:click={create}>
				{$lang('save')}
			</button>
		</div>
	</Modal>
{/if}

<style>
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.8rem;
	}

	.error {
		color: red;
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
	}

	br {
		margin-bottom: 1rem;
	}
</style>
