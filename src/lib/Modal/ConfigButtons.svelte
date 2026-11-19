<script lang="ts">
	import { dashboard, record, lang, editMode, ripple, motion } from '$lib/Stores';
	import { tick } from 'svelte';
	import { closeModal, openModal } from 'svelte-modals';
	import Ripple from 'svelte-ripple';
	import { fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	export let sel: any = undefined;
	export let disableChangeType: boolean | undefined = undefined;

	function portalToModal(node: HTMLElement) {
		const contents = node.closest('.contents') as HTMLElement | null;
		if (contents) contents.appendChild(node);
		return { destroy() {} };
	}

	/**
	 * Checks if current id is in/from sidebar
	 */
	function sidebarItem() {
		return ($dashboard?.sidebar ?? []).some((item) => item?.id === sel?.id);
	}

	/**
	 * Removes a sidebarItem
	 */
	function removeSidebarItem() {
		$dashboard.sidebar = $dashboard.sidebar.filter((item) => item?.id !== sel?.id);
	}

	/**
	 * Get id from a mainItem
	 */
	function mainItem() {
		$dashboard.views = $dashboard.views.map((view) => ({
			...view,
			sections: view.sections?.map((section) => ({
				...section,
				sections:
					(section.type === 'horizontal-stack' || section.type === 'vertical-stack') &&
					section.sections
						? section.sections.map((nestedSection) => ({
								...nestedSection,
								items: nestedSection.items?.filter((item) => item.id !== sel.id)
							}))
						: section.sections,
				items:
					section.type !== 'horizontal-stack' && section.type !== 'vertical-stack'
						? section.items?.filter((item) => item.id !== sel.id)
						: section.items
			}))
		}));
	}

	const sizedMainTypes = [
		'button',
		'custom_panel',
		'camera',
		'picture_elements',
		'empty',
		'conditional_media',
		'doorbell',
		'music_assistant',
		'iframe',
		'remote',
		'movie_pilot'
	];
	const legacyLargeTileTypes = ['conditional_media', 'picture_elements', 'camera', 'doorbell', 'movie_pilot'];
	$: showSizeOptions =
		!!sel?.type &&
		sizedMainTypes.includes(sel.type) &&
		!($dashboard?.sidebar ?? []).some((item) => item?.id === sel?.id);

	function setSize(size: 'small' | 'medium' | 'large') {
		if (!sel) return;
		sel.tile_size = size;
		if (sel.type === 'button') sel.size = size;
		$dashboard = $dashboard;
		$record();
	}

	function selectedTileSize() {
		return (
			sel?.tile_size ||
			(sel?.type === 'button' ? sel?.size : undefined) ||
			(legacyLargeTileTypes.includes(sel?.type) ? 'large' : 'small')
		);
	}

	/**
	 * Removes a ViewItem
	 */
	async function removeViewItem() {
		const index = $dashboard.views.findIndex((view) => view.id === sel.id);
		$dashboard.views = [...$dashboard.views.slice(0, index), ...$dashboard.views.slice(index + 1)];
		// selects another view
		await tick();
		const adjust = Math.min(index, $dashboard.views.length - 1);
		const view = document
			.getElementById('navigation')
			?.querySelector<HTMLButtonElement>(`button:nth-of-type(${adjust + 1})`);
		view?.click();
	}

	/**
	 * Removes 'SidebarItem' | 'MainItem' | 'ViewItem' from `$dashboard`.
	 */
	async function removeObj() {
		if (!sel) return;
		closeModal();

		if (sidebarItem()) {
			removeSidebarItem();
		} else if (sel?.type) {
			mainItem();
		} else if (sel.sections) {
			await removeViewItem();
		}
		$record();
	}

	/**
	 * Handle object type change
	 */
	async function handleChangeType() {
		closeModal();

		if (sidebarItem()) {
			openModal(() => import('$lib/Modal/SidebarItemConfig.svelte'), { sel });
		} else {
			openModal(() => import('$lib/Modal/MainItemConfig.svelte'), { sel });
		}
	}
</script>

<div class="container" use:portalToModal>
	{#if $editMode && showSizeOptions}
		<div class="size-options" role="group" aria-label={$lang('button_size') || 'Tile size'}>
			{#each ['small', 'medium', 'large'] as size}
				<button
					class="size-option"
					class:selected={selectedTileSize() === size}
					on:click={() => setSize(size as 'small' | 'medium' | 'large')}
					use:Ripple={$ripple}
				>
					<span class="size-icon" class:medium={size === 'medium'} class:large={size === 'large'}>
						<Icon icon="mdi:view-grid-outline" />
					</span>
					<span>{$lang(size)}</span>
				</button>
			{/each}
		</div>
	{/if}
	<div class="align-left">
		{#if $editMode && (sel?.type || sel?.sections)}
			<button
				transition:fade={{ duration: $motion }}
				class="remove action"
				on:click={removeObj}
				use:Ripple={{
					...$ripple,
					color: 'rgba(0, 0, 0, 0.35)'
				}}
			>
				{$lang('remove')}
			</button>

			{#if !disableChangeType === true}
				<button
					transition:fade={{ duration: $motion }}
					class="options action"
					on:click={() => {
						handleChangeType();
					}}
					use:Ripple={$ripple}
				>
					{$lang('change_type')}
				</button>
			{/if}
		{/if}
	</div>

	<button class="done action" on:click={closeModal} use:Ripple={$ripple}>
		{$lang('done')}
	</button>
</div>

<style>
	.container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0 -1.9rem -1.9rem;
		padding: 0.75rem 1.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.size-options {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-right: auto;
	}

	.size-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--theme-border-color, rgba(127, 127, 127, 0.35));
		border-radius: 0.55rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.size-option.selected {
		background: var(--theme-button-background-color-on, rgba(127, 127, 127, 0.2));
		border-color: var(--theme-accent-color, currentColor);
	}

	.size-icon { display: grid; place-items: center; }
	.size-icon.medium { transform: scaleY(1.15); }
	.size-icon.large { transform: scale(1.18); }

	@media (max-width: 520px) {
		.container { flex-wrap: wrap; gap: 0.55rem; }
		.size-options { width: 100%; order: -1; }
		.size-option { flex: 1; justify-content: center; }
	}

	.align-left {
		display: flex;
		gap: 0.8rem;
	}
</style>
