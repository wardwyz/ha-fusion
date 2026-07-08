<script lang="ts">
	// eventually merge with SidebarItemConfig.svelte...

	import { dashboard, record, lang, motion, ripple, states, demo } from '$lib/Stores';
	import { openModal, closeModal } from 'svelte-modals';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import InputClear from '$lib/Components/InputClear.svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import { getCameraEntity, getSensorEntity } from '$lib/Modal/getRandomEntity';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Ripple from 'svelte-ripple';
	import Icon from '@iconify/svelte';

	export let isOpen: boolean;
	export let sel: any;

	let searchString = '';
	let searchElement: HTMLInputElement;

	// get random preview entities
	if (!$demo.camera) $demo.camera = getCameraEntity($states);
	if (!$demo.sensor) $demo.sensor = getSensorEntity($states);

	let loadIcons: (typeof import('@iconify/svelte'))['loadIcons'];
	let icons: Record<string, string>;

	onMount(async () => {
		if (searchElement) {
			searchElement.focus();
		}

		// if changing type reset object
		if (sel) {
			Object.keys(sel).forEach((key) => {
				if (key !== 'id') {
					delete (sel as any)[key];
				}
			});
			sel.type = 'configure';
			$dashboard = $dashboard;
		}

		// picture elements config, need to be loaded before click but can be deferred to onmount
		const [iconifyModule, iconsModule] = await Promise.all([
			import('@iconify/svelte'),
			import('$lib/Modal/PictureElements/icons')
		]);

		loadIcons = iconifyModule.loadIcons;
		icons = iconsModule.icons;
	});

	$: filter = itemTypes
		.filter(
			({ id, type }) =>
				id.toLowerCase().includes(searchString.toLowerCase()) ||
				type.toLowerCase().includes(searchString.toLowerCase())
		)
		.sort((a, b) => a.type.localeCompare(b.type));

	let itemTypes: {
		id: string;
		type: string;
		preview_icon?: string;
	}[];

	$: itemTypes = [
		{
			id: 'button',
			type: $lang('button'),
			preview_icon: 'mdi:lightbulb-outline'
		},
		{
			id: 'custom_panel',
			type: $lang('custom_panel') || 'Custom Panel'
		},
		{
			id: 'camera',
			type: $lang('camera'),
			preview_icon: 'mdi:camera-outline'
		},
		{
			id: 'picture_elements',
			type: $lang('picture_elements'),
			preview_icon: 'solar:gallery-wide-bold-duotone'
		},
		{
			id: 'empty',
			type: $lang('empty'),
			preview_icon: 'mdi:rectangle-outline'
		},
		{
			id: 'conditional_media',
			type: `${$lang('conditional')} ${$lang('media')?.toLocaleLowerCase()}`,
			preview_icon: 'solar:tv-bold-duotone'
		},
		{
			id: 'doorbell',
			type: $lang('doorbell') || 'Doorbell',
			preview_icon: 'mdi:doorbell'
		},
		{
			id: 'music_assistant',
			type: $lang('music_assistant') || 'Music Assistant',
			preview_icon: 'solar:music-note-2-bold-duotone'
		},
		{
			id: 'iframe',
			type: $lang('iframe'),
			preview_icon: 'fontisto:world-o'
		},
		{
			id: 'remote',
			type: $lang('remote'),
			preview_icon: 'mdi:remote'
		},
		{
			id: 'movie_pilot',
			type: $lang('movie_pilot') || 'MoviePilot',
			preview_icon: 'solar:videocamera-record-bold-duotone'
		}
	];

	async function handleClick(id: string) {
		closeModal();

		// set sidebar item type
		if (sel && sel?.type) {
			sel.type = id;
			$dashboard = $dashboard;
		}
		$record();

		switch (sel?.type) {
			case 'button':
				openModal(() => import('$lib/Modal/ButtonConfig.svelte'), {
					demo: $demo.sensor,
					sel
				});
				break;
			case 'camera':
				openModal(() => import('$lib/Modal/CameraConfig.svelte'), {
					demo: $demo.camera,
					sel
				});
				break;
			case 'conditional_media':
				openModal(() => import('$lib/Modal/ConditionalMediaConfig.svelte'), {
					demo: $demo.media_player,
					sel
				});
				break;
			case 'picture_elements': {
				loadIcons(Object.values(icons));

				openModal(() => import('$lib/Modal/PictureElements/PictureElementsConfig.svelte'), {
					sel
				});

				break;
			}
			case 'custom_panel':
				openModal(() => import('$lib/Modal/CustomPanelConfig.svelte'), { sel });
				break;
			case 'empty':
				openModal(() => import('$lib/Modal/EmptyConfig.svelte'), { sel });
				break;
			case 'doorbell':
				openModal(() => import('$lib/Modal/DoorbellConfig.svelte'), { sel });
				break;
			case 'music_assistant':
				openModal(() => import('$lib/Modal/MusicAssistantConfig.svelte'), { sel });
				break;
			case 'iframe':
				openModal(() => import('$lib/Modal/IframeGridConfig.svelte'), { sel });
				break;
			case 'remote':
				openModal(() => import('$lib/Modal/RemoteConfig.svelte'), { sel });
				break;
			case 'movie_pilot':
				openModal(() => import('$lib/Modal/MoviePilotConfig.svelte'), { sel });
				break;
			default:
				openModal(() => import('$lib/Modal/MainItemConfig.svelte'), { sel });
		}
	}

	/**
	 * Handle keydown when pressing Esc key. Clear
	 * `searchElement` if focused else close modal
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.stopPropagation();

		if (searchElement === document.activeElement && searchString) {
			searchElement.blur();
			searchString = '';
		} else {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown|capture={handleKeydown} />

{#if isOpen}
	<Modal size="large">
		<h1 slot="title">{$lang('options')}</h1>

		<div class="search">
			<InputClear
				condition={searchString}
				on:clear={() => {
					searchString = '';
				}}
				let:padding
			>
				<input
					name={$lang('search')}
					class="input"
					type="text"
					placeholder={$lang('search')}
					autocomplete="off"
					spellcheck="false"
					bind:this={searchElement}
					bind:value={searchString}
					style:padding
				/>
			</InputClear>
		</div>

		<div class="container">
			{#each filter as { id, type, preview_icon } (id)}
				<button
					on:click={() => handleClick(id)}
					animate:flip={{ duration: $motion }}
					use:Ripple={$ripple}
				>
					<div class="preview">
						{#if id === 'custom_panel'}
							<div class="cp-preview">
								<div class="cp-icon">
									<Icon icon="mdi:view-dashboard-edit" height="none" />
								</div>
								<span>Custom Panel</span>
							</div>
						{:else if preview_icon}
							<div class="preview-icon">
								<Icon icon={preview_icon} height="none" />
							</div>
						{/if}
					</div>
					<div class="footer">{type}</div>
				</button>
			{/each}
		</div>

		<ConfigButtons {sel} disableChangeType={true} />
	</Modal>
{/if}

<style>
	.container {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem;
		overflow: auto;
		align-content: start;
	}

	.container::-webkit-scrollbar {
		width: 5px;
	}

	.container::-webkit-scrollbar-track {
		background: transparent;
	}

	.container::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.container::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.35);
	}

	button {
		display: flex;
		flex-direction: column;
		padding: 0;
		font-family: inherit;
		cursor: pointer;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.8rem;
		background-color: rgba(255, 255, 255, 0.04);
		height: 10rem;
		outline-offset: -2px;
		overflow: hidden;
		transition:
			border-color 150ms ease,
			background-color 150ms ease;
	}

	button:hover {
		border-color: rgba(255, 255, 255, 0.22);
		background-color: rgba(255, 255, 255, 0.07);
	}

	.preview {
		flex: 1;
		color: white;
		padding: 0 1.2rem;
		min-width: -webkit-fill-available;
		display: flex;
		align-items: center;
		min-height: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.cp-preview {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.cp-icon {
		width: 2.4rem;
		height: 2.4rem;
		background-color: rgba(0, 0, 0, 0.25);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.cp-preview span {
		font-size: 0.95rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.7;
	}

	.footer {
		padding: 0.45rem 0.9rem 0.5rem;
		color: rgba(255, 255, 255, 0.45);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: left;
	}

	.preview-icon {
		width: 3rem;
		opacity: 0.35;
		margin: auto;
	}

	.search {
		margin: 1rem 0;
	}

	/* Large phones / phablets (480px – 767px) */
	@media (min-width: 480px) and (max-width: 767px) {
		.container {
			grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		}
	}

	/* Tablets (768px – 1023px) */
	@media (min-width: 768px) and (max-width: 1023px) {
		.container {
			grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		}

		button {
			height: 10.5rem;
		}
	}

	/* FHD monitors (1366px – 1919px) */
	@media (min-width: 1366px) and (max-width: 1919px) {
		.container {
			grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
			gap: 0.9rem;
		}

		button {
			height: 11rem;
		}
	}

	/* QHD / 4K (≥ 1920px) */
	@media (min-width: 1920px) {
		.container {
			grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
			gap: 1.1rem;
		}

		button {
			height: 12.5rem;
		}
	}
</style>
