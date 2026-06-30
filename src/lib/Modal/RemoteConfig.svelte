<script lang="ts">
	import { dashboard, record, lang, ripple, motion, dragging, entityList } from '$lib/Stores';
	import Modal from '$lib/Modal/Index.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Select from '$lib/Components/Select.svelte';
	import InputClear from '$lib/Components/InputClear.svelte';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { onDestroy } from 'svelte';
	import { generateId, updateObj } from '$lib/Utils';
	import type { RemoteItem, RemoteButton } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: RemoteItem;

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event) as RemoteItem;
		$dashboard = $dashboard;
	}

	$: remoteEntities = $entityList('remote');

	let buttons: RemoteButton[] = sel?.buttons ? [...sel.buttons] : [];

	function newId(): number {
		return generateId($dashboard);
	}

	function isShadow(b: any): boolean {
		return !!b[SHADOW_ITEM_MARKER_PROPERTY_NAME];
	}

	function buttonKey(b: any): string {
		return `${b.id}${isShadow(b) ? '_shadow' : ''}`;
	}

	function sync() {
		sel.buttons = buttons
			.filter((b) => !isShadow(b))
			.map((b) => {
				const clean: Record<string, unknown> = {};
				for (const key of Object.keys(b)) {
					if (key !== SHADOW_ITEM_MARKER_PROPERTY_NAME) clean[key] = (b as any)[key];
				}
				return clean as unknown as RemoteButton;
			});
		$dashboard = $dashboard;
	}

	function addButton() {
		buttons = [...buttons, { id: newId() }];
		sync();
		$record();
	}

	function removeButton(id: number) {
		buttons = buttons.filter((b) => b.id !== id);
		sync();
		$record();
	}

	function updateButton(id: number, patch: Partial<RemoteButton>) {
		buttons = buttons.map((b) => (b.id === id ? { ...b, ...patch } : b));
		sync();
	}

	function handleDnd(event: CustomEvent) {
		$dragging = true;
		buttons = event.detail.items;

		if (event.type === 'finalize') {
			$dragging = false;
			sync();
			$record();
		}
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal size="large">
		<h1 slot="title">{sel?.name || $lang('remote')}</h1>

		<h2>{$lang('name')}</h2>
		<input
			class="input"
			type="text"
			value={sel?.name ?? ''}
			placeholder={$lang('name')}
			on:input={(e) => set('name', e)}
		/>

		<h2>{$lang('icon')}</h2>
		<div class="icon-gallery-container">
			<InputClear condition={sel?.icon} on:clear={() => set('icon')} let:padding>
				<input
					class="input"
					type="text"
					placeholder={$lang('icon')}
					value={sel?.icon ?? ''}
					autocomplete="off"
					spellcheck="false"
					on:input={(e) => set('icon', e)}
					style:padding
				/>
			</InputClear>
			<button
				class="icon-gallery"
				use:Ripple={$ripple}
				title={$lang('icon')}
				on:click={() => window.open('https://icon-sets.iconify.design/', '_blank')}
			>
				<Icon icon="majesticons:open-line" height="1.2rem" />
			</button>
		</div>

		<h2>{$lang('buttons')}</h2>

		{#if buttons.length > 0}
			<section
				class="button-list"
				use:dndzone={{ items: buttons, flipDurationMs: $motion, dropTargetStyle: {} }}
				on:consider={handleDnd}
				on:finalize={handleDnd}
			>
				{#each buttons as button (buttonKey(button))}
					<div
						class="button-row"
						animate:flip={{ duration: $motion }}
						data-is-dnd-shadow-item-hint={isShadow(button)}
					>
						<div class="button-row-header">
							<span class="drag-handle">
								<Icon icon="mdi:drag" height="1rem" />
							</span>
							<input
								class="input button-name"
								type="text"
								placeholder={$lang('name')}
								value={button.name ?? ''}
								on:input={(e) =>
									updateButton(button.id, { name: e.currentTarget.value || undefined })}
							/>
							<button
								class="remove-btn"
								on:click={() => removeButton(button.id)}
								use:Ripple={{ ...$ripple, color: 'rgba(255,80,80,0.3)' }}
								title={$lang('remove')}
							>
								<Icon icon="mingcute:close-fill" height="0.9rem" />
							</button>
						</div>

						<div class="button-row-fields">
							<input
								class="input"
								type="text"
								placeholder={$lang('icon')}
								value={button.icon ?? ''}
								on:input={(e) =>
									updateButton(button.id, { icon: e.currentTarget.value || undefined })}
							/>

							<Select
								options={remoteEntities}
								placeholder={$lang('entity')}
								value={button.entity_id}
								computeIcons={true}
								on:change={(e) => updateButton(button.id, { entity_id: e.detail })}
							/>

							<input
								class="input"
								type="text"
								placeholder={$lang('command')}
								value={button.command ?? ''}
								on:input={(e) =>
									updateButton(button.id, { command: e.currentTarget.value || undefined })}
							/>

							<input
								class="input"
								type="text"
								placeholder={$lang('device')}
								value={button.device ?? ''}
								on:input={(e) =>
									updateButton(button.id, { device: e.currentTarget.value || undefined })}
							/>
						</div>
					</div>
				{/each}
			</section>
		{:else}
			<p class="no-buttons">{$lang('no_buttons')}</p>
		{/if}

		<button class="action done mt" on:click={addButton} use:Ripple={$ripple}>
			+ {$lang('add_button')}
		</button>

		<ConfigButtons {sel} />
	</Modal>
{/if}

<style>
	.icon-gallery-container {
		display: flex;
		gap: 0.4rem;
	}

	.icon-gallery-container :global(.clear) {
		flex: 1;
	}

	.icon-gallery {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border: none;
		border-radius: 0.5rem;
		color: inherit;
		cursor: pointer;
		flex-shrink: 0;
		padding: 0.84rem;
		position: relative;
		overflow: hidden;
	}

	.icon-gallery:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.button-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.button-row {
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 0.6rem;
		padding: 0.6rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.button-row-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.drag-handle {
		display: flex;
		opacity: 0.3;
		cursor: grab;
		flex-shrink: 0;
	}

	.button-name {
		flex: 1;
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		opacity: 0.4;
		border-radius: 0.3rem;
		padding: 0.3rem;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		opacity: 1;
		background-color: rgba(255, 80, 80, 0.2);
	}

	.button-row-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.no-buttons {
		opacity: 0.4;
		font-size: 0.85rem;
		margin: 0.5rem 0;
	}

	.mt {
		margin-top: 0.8rem;
	}
</style>
