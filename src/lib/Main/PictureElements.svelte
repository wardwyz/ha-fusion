<script lang="ts">
	import type { KonvaViewer } from '$lib/Modal/PictureElements/konvaViewer';
	import { onDestroy, onMount, tick } from 'svelte';
	import { dashboard, editMode } from '$lib/Stores';
	import { openModal } from 'svelte-modals';
	import type { Dashboard } from '$lib/Types';
	import { loadIcons } from '@iconify/svelte';
	import { icons } from '$lib/Modal/PictureElements/icons';

	export let sel: any;

	let konva: KonvaViewer;
	let canvas: HTMLDivElement;
	let canvasObserver: ResizeObserver;
	const designWidth = 470;
	const designHeight = 265;

	function resizeStage() {
		if (!konva || !canvas) return;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (!width || !height) return;

		const scale = Math.min(width / designWidth, height / designHeight);
		konva.stage.size({ width, height });
		konva.layer.scale({ x: scale, y: scale });
		konva.layer.position({
			x: (width - designWidth * scale) / 2,
			y: (height - designHeight * scale) / 2
		});
		konva.stage.batchDraw();
	}

	/**
	 * Setup konva by importing it on
	 * mount because of ssr and canvas
	 */
	onMount(async () => {
		if (konva) return;

		const { KonvaViewer } = await import('$lib/Modal/PictureElements/konvaViewer');

		if (canvas) {
			konva = new KonvaViewer(canvas, {
				className: 'Stage',
				attrs: {
					width: canvas?.offsetWidth,
					height: canvas?.offsetHeight,
					id: sel?.id?.toString()
				},
				children: [
					{
						className: 'Layer',
						children: sel?.elements || []
					}
				]
			});

			canvasObserver = new ResizeObserver(resizeStage);
			canvasObserver.observe(canvas);
			resizeStage();
		}
	});

	/**
	 * Update konva on dashboard change
	 * without tearing it down (no compare)
	 */
	$: updateKonva($dashboard);

	async function updateKonva($dashboard: Dashboard) {
		if (!konva || !canvas || !$dashboard) return;
		await tick();
		const elements = sel?.elements || [];
		await konva.updateLayerChildren(elements);
	}

	/**
	 * Handle $editMode click to open
	 * picture elements config modal
	 */
	async function handleClick() {
		if (!$editMode) return;

		// import in parallel
		const [PictureElementsConfig] = await Promise.all([
			import('$lib/Modal/PictureElements/PictureElementsConfig.svelte'),
			loadIcons(Object.values(icons))
		]);

		// open modal
		openModal(PictureElementsConfig.default, {
			sel
		});
	}

	/**
	 * Konva cleanup on destroy
	 */
	onDestroy(() => {
		if (konva) konva.destroyViewer();
		canvasObserver?.disconnect();
	});
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->

<div
	on:click={handleClick}
	bind:this={canvas}
	style:cursor={$editMode ? 'unset' : 'default'}
	style:height="100%"
	style:background-color={!sel?.elements?.length
		? 'var(--theme-button-background-color-off)'
		: 'transparent'}
></div>

<style>
	div {
		width: 100%;
		border-radius: 1rem;
		border-radius: 0.6rem;
		overflow: hidden;
	}
</style>
