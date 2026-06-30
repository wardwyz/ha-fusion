<script lang="ts">
	import { entityList, lang, ripple, dashboard, states, connection } from '$lib/Stores';
	import { closeModal, openModal } from 'svelte-modals';
	import { openEntityModal, getTogglableService, getName } from '$lib/Utils';
	import { callService } from 'home-assistant-js-websocket';
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

	/**
	 * Searches every view's sections (including nested horizontal/vertical
	 * stacks) for an existing `button`-type tile configured for `entity_id`,
	 * so selecting an entity from the palette behaves exactly like clicking
	 * its dashboard tile, if one already exists.
	 */
	function findExistingTile(entity_id: string): any {
		for (const view of $dashboard?.views ?? []) {
			const found = searchSections(view?.sections, entity_id);
			if (found) return found;
		}
		return undefined;
	}

	function searchSections(sections: any[] | undefined, entity_id: string): any {
		if (!sections?.length) return undefined;
		for (const section of sections) {
			if (
				(section?.type === 'horizontal-stack' || section?.type === 'vertical-stack') &&
				section?.sections
			) {
				const found = searchSections(section.sections, entity_id);
				if (found) return found;
			}
			const item = section?.items?.find(
				(i: any) => i.type === 'button' && i.entity_id === entity_id
			);
			if (item) return item;
		}
		return undefined;
	}

	async function selectResult(entity_id: string) {
		const sel = findExistingTile(entity_id);

		// replicate the tile's direct-toggle behavior (more_info: false)
		if (sel?.more_info === false) {
			const entity = $states?.[entity_id];
			const service = entity && getTogglableService(entity);

			if (service) {
				const [domain, svc] = service.split('.');

				if (sel?.confirm) {
					closeModal();
					openModal(() => import('$lib/Modal/ConfirmAlert.svelte'), {
						title: getName(sel, entity, undefined) || $lang('unknown'),
						message: $lang('confirm_action'),
						confirm: () => {
							closeModal();
							callService($connection, domain, svc, { entity_id });
						},
						cancel: () => closeModal()
					});
					return;
				}

				closeModal();
				callService($connection, domain, svc, { entity_id });
				return;
			}
		}

		closeModal();
		await openEntityModal(entity_id, sel);
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
		margin-top: 1.3rem;
		margin-bottom: 0.8rem;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: 50vh;
		overflow-y: auto;
	}

	.result {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		align-items: flex-start;
		gap: 0.15rem;
		padding: 0.7rem 0.9rem;
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
