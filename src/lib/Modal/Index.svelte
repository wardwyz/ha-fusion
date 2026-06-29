<script lang="ts">
	import { motion, autocompleteOpen, ripple, dragging } from '$lib/Stores';
	import { onMount, onDestroy } from 'svelte';
	import { modals, closeModal } from 'svelte-modals';
	import { fly, scale } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';

	import { trapFocus } from '$lib/Modal/trapFocus';
	import '$lib/Modal/Modal.css';

	export let backdropImage = true;
	export let size: string | undefined = undefined;
	export let fill: boolean = false;

	let backdrop: HTMLDivElement | null;
	let contents: HTMLDivElement | null;
	let opacityValue = 1;
	let draggingModal = false;
	let top = 0;
	let startTop = 0;
	let threshold = window.innerHeight * 0.15;

	$: if (draggingModal && contents) {
		contents.style.backdropFilter = 'blur(2rem)';
		(contents.style as any).webkitBackdropFilter = 'blur(2rem)';
	} else {
		setTimeout(() => {
			if (contents && backdropImage) {
				contents.style.backdropFilter = 'none';
				(contents.style as any).webkitBackdropFilter = 'none';
			}
		}, $motion);
	}

	// delay count to prevent backdrop flickering on stacked modals
	let delayedModalCount: number;
	$: if ($modals.length === 1) {
		setTimeout(() => {
			delayedModalCount = 1;
		}, $motion);
	} else {
		delayedModalCount = 2;
	}

	function debounce(func: any, wait: number | undefined) {
		let timeout: ReturnType<typeof setTimeout>;
		return function executedFunction(...args: any[]) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	function handleOpacityChange() {
		opacityValue = 1 - (top / window.innerHeight) * 3;
		if (opacityValue < 0) opacityValue = 0;
		if (opacityValue > 1) opacityValue = 1;
		if (backdrop) {
			backdrop.style.transition = 'opacity 100ms ease';
			backdrop.style.opacity = opacityValue.toString();
		}
	}

	const debouncedOpacityChange = debounce(handleOpacityChange, 50);

	$: if (delayedModalCount === 1 && backdrop) debouncedOpacityChange();

	onMount(() => {
		if (document?.body) document.body.style.overflow = 'hidden';

		backdrop = document.querySelector('div.backdrop');
		if (backdropImage) {
			if (backdrop) {
				backdrop.style.backgroundColor = 'black';
				backdrop.style.backgroundImage = 'var(--theme-background-image)';
			}
		} else {
			if (backdrop) {
				backdrop.style.backgroundImage = 'none';
				backdrop.style.backgroundColor = 'rgba(0,0,0,0.3)';
			}
		}
	});

	onDestroy(async () => {
		if ($modals.length === 0) {
			document.body.style.overflow = 'unset';
		}
	});

	function prevent(target: any) {
		const selectors = [
			'[data-exclude-drag-modal]',
			'button',
			'img',
			'input',
			'pre',
			'[class^="cm-"]', // codemirror
			'[slot="item"]', // select
			'[class^="maplibregl-"]', // maplibre
			'.IroHandle, .IroSliderGradient, .IroWheelBorder' // iro
		];

		// console.debug(target);

		while (target) {
			if (target.matches && selectors.some((selector) => target.matches(selector))) {
				return true;
			}
			target = target.parentNode;
		}
		return false;
	}

	function handlePointerDown(event: { target: any }) {
		if (prevent(event.target)) {
			return;
		}
		draggingModal = true;
		startTop = top;
	}

	function handlePointerMove(event: { movementY: number; buttons: number }) {
		if (draggingModal && event.buttons !== 0) {
			let newTop = top + event.movementY;
			if (event.movementY < 0 && newTop < 0) {
				newTop = 0;
			}
			top = newTop;
		} else {
			draggingModal = false;
		}
	}

	function handlePointerUp() {
		draggingModal = false;
		if (top - startTop > threshold) {
			if (backdrop) backdrop.style.transition = 'none';
			closeModal();
		} else {
			if (backdrop) backdrop.style.transition = 'opacity 100ms ease-out';
			top = 0;
		}
	}

	function handleKeydown(event: any) {
		if (event.key === 'Escape') {
			if (!$autocompleteOpen && !$dragging) {
				closeModal();
			}
		}
	}
</script>

<svelte:window
	on:pointerup={handlePointerUp}
	on:pointermove={handlePointerMove}
	on:keydown={handleKeydown}
/>

<div
	role="dialog"
	in:fly|global={{
		duration: $motion * 3,
		y: -35,
		easing: expoOut,
		opacity: 0.9
	}}
	out:scale|global={{ duration: $motion / 2, start: 0.85 }}
>
	<div
		id="modal"
		on:pointerdown={handlePointerDown}
		style:transform="translateY({top}px)"
		style:transition={!draggingModal ? `transform ${$motion}ms ease-out` : 'none'}
		use:trapFocus
	>
		<div
			style:width={size === 'large' ? '80vw' : '40rem'}
			class="contents"
			bind:this={contents}
			class:large={size === 'large'}
			class:warning={!backdropImage}
			class:fill-contents={fill}
		>
			<div class="header">
				<h1>
					<slot name="title" />
				</h1>

				<button
					on:click={() => {
						closeModal();
					}}
					aria-label="close"
					style:outline="none"
					use:Ripple={$ripple}
					tabindex="-1"
				>
					<Icon icon="mingcute:close-fill" height="none" />
				</button>
			</div>

			<div class="body" class:fill>
				<slot />
			</div>

			{#if $$slots.footer}
				<div class="footer">
					<slot name="footer" />
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.header {
		display: flex;
		justify-content: space-between;
	}

	.warning {
		color: white;
		background-color: rgb(38 39 38) !important;
	}

	div[role='dialog'] {
		position: fixed;
		top: 0;
		bottom: 0;
		right: 0;
		left: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		pointer-events: none;
		z-index: 3;
		touch-action: none;
	}

	#modal {
		display: flex;
		justify-content: center;
		align-items: center;
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
	}

	.contents {
		padding: 1.6rem 1.9rem 1.9rem 1.9rem;
		background-color: var(--theme-modal-background-color-modal);
		display: flex;
		flex-direction: column;
		pointer-events: auto;
		max-height: 85vh;
		max-width: 85vw;
		border-radius: 1.2rem;
		position: relative;
		box-shadow: rgba(0, 0, 0, 0.56) 0px 22px 70px 4px;
		outline: 1px solid rgba(255, 255, 255, 0.25);
		overflow: hidden;
	}

	.body {
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		/* extend into padding on both sides: right for scrollbar, left to avoid border clipping */
		margin-right: -1.9rem;
		padding-right: 1.9rem;
		margin-left: -1px;
		padding-left: 1px;
		padding-bottom: 0.6rem;
	}

	.fill-contents {
		height: 85vh;
	}

	.body.fill {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding-bottom: 0;
	}

	.body::-webkit-scrollbar {
		width: 5px;
	}

	.body::-webkit-scrollbar-track {
		background: transparent;
	}

	.body::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.body::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.35);
	}

	.footer {
		flex-shrink: 0;
	}

	button {
		width: 1.85rem;
		background: none;
		color: inherit;
		cursor: pointer;
		margin: 0.06rem -0.25rem 0 0;
		padding: 0;
		border: none;
		border-radius: 50%;
	}

	button:focus {
		color: inherit;
	}

	/* Small phones (< 480px) — quasi full-screen */
	@media (max-width: 479px) {
		.contents {
			width: 96vw !important;
			max-width: 96vw;
			max-height: 90vh;
			padding: 1.1rem 1.1rem 1.3rem;
			border-radius: 0.9rem;
		}

		.fill-contents {
			height: 90vh;
		}

		.body {
			padding-bottom: 0.45rem;
		}
	}

	/* Large phones / phablets (480px – 767px) */
	@media (min-width: 480px) and (max-width: 767px) {
		.contents {
			width: 90vw !important;
			max-width: 90vw;
			max-height: 88vh;
			padding: 1.4rem 1.5rem 1.7rem;
		}

		.fill-contents {
			height: 88vh;
		}
	}

	/* Tablets portrait (768px – 1023px) */
	@media (min-width: 768px) and (max-width: 1023px) {
		.contents {
			max-height: 82vh;
		}

		.fill-contents {
			height: 82vh;
		}
	}

	/* FHD monitors (1366px – 1919px) */
	@media (min-width: 1366px) and (max-width: 1919px) {
		.contents {
			max-height: 80vh;
		}

		.fill-contents {
			height: 80vh;
		}
	}

	/* QHD / 4K displays (≥ 1920px) */
	@media (min-width: 1920px) {
		.contents {
			padding: 2rem 2.5rem 2.5rem;
			max-height: 75vh;
			border-radius: 1.5rem;
		}

		.fill-contents {
			height: 75vh;
		}

		.body {
			padding-bottom: 0.75rem;
		}
	}
</style>
