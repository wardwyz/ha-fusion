<script lang="ts">
	import { entityList, lang, ripple } from '$lib/Stores';
	import { closeModal } from 'svelte-modals';
	import { openEntityModal } from '$lib/Utils';
	import Modal from '$lib/Modal/Index.svelte';
	import Ripple from 'svelte-ripple';
	import { onMount } from 'svelte';

	export let isOpen: boolean;

	let query = '';
	let highlightedIndex = 0;
	let input: HTMLInputElement;

	$: allEntities = $entityList('');

	$: filteredResults = query.trim()
		? allEntities
				.filter((entity) => {
					const q = query.trim().toLowerCase();
					return (
						entity.label.toLowerCase().includes(q) ||
						entity.id.toLowerCase().includes(q) ||
						(entity.hint && entity.hint.toLowerCase().includes(q))
					);
				})
				.slice(0, 50)
		: [];

	$: if (filteredResults) highlightedIndex = 0;

	onMount(() => {
		input?.focus();
	});

	async function selectResult(entity_id: string) {
		closeModal();
		await openEntityModal(entity_id);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, filteredResults.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const selected = filteredResults[highlightedIndex];
			if (selected) selectResult(selected.id);
		}
	}
</script>

{#if isOpen}
	<Modal backdropImage={false}>
		<h1 slot="title">{$lang('search')}</h1>

		<input
			bind:this={input}
			bind:value={query}
			on:keydown={handleKeydown}
			type="text"
			class="search-input"
			placeholder={$lang('search')}
			autocomplete="off"
			spellcheck="false"
		/>

		<div class="results">
			{#each filteredResults as result, index (result.id)}
				<button
					class="result"
					class:highlighted={index === highlightedIndex}
					on:click={() => selectResult(result.id)}
					on:pointerenter={() => (highlightedIndex = index)}
					use:Ripple={$ripple}
				>
					<span class="label">{result.label}</span>
					{#if result.hint}
						<span class="hint">{result.hint}</span>
					{/if}
				</button>
			{/each}
		</div>
	</Modal>
{/if}

<style>
	.search-input {
		width: 100%;
		padding: 0.7rem 0.9rem;
		border-radius: 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background-color: rgba(0, 0, 0, 0.2);
		color: white;
		font-family: inherit;
		font-size: 1rem;
		margin-bottom: 0.8rem;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-height: 50vh;
		overflow-y: auto;
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.6rem 0.8rem;
		border-radius: 0.5rem;
		background: none;
		border: none;
		color: inherit;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		width: 100%;
	}

	.result.highlighted {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.label {
		font-size: 0.95rem;
	}

	.hint {
		font-size: 0.8rem;
		opacity: 0.5;
	}
</style>
