<script lang="ts">
	import { connection, motion } from '$lib/Stores';
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import iro from '@jaames/iro';
	import { callService, type HassEntity } from 'home-assistant-js-websocket';

	// const colorSupport = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
	// const brightnessSupport = [...colorSupport, 'color_temp', 'brightness', 'white'];

	export let entity: HassEntity;
	export let colorMode: any;
	export let supportedColorModes: any;

	export let tempSelected: boolean;
	export let colorSelected: boolean;

	let picker: iro.ColorPicker;
	let element: HTMLDivElement;
	let kelvinNumber: number | undefined = undefined;

	let timeout: ReturnType<typeof setTimeout> | undefined;
	let interacting = false;

	let request: Promise<unknown> | undefined = undefined;

	$: attributes = entity?.attributes;
	$: rgbColor = attributes?.rgb_color;
	$: colorTempKelvin = attributes?.color_temp_kelvin;

	let prevColorTempKelvin: number | undefined;
	let prevRgbColor: number[] | undefined;

	/**
	 * If changing color and quickly selecting temperature tab, the last
	 * service call will be a temperature value... Prevent this behavior
	 */
	$: if (tempSelected) {
		interacting = false;
	}

	const colorLayout = [
		{
			component: iro.ui.Wheel,
			options: {
				wheelAngle: 270,
				wheelDirection: 'clockwise'
			}
		}
	];

	$: temperatureLayout = [
		{
			component: iro.ui.Slider,
			options: {
				sliderShape: 'circle',
				sliderType: 'kelvin',
				minTemperature: attributes?.min_color_temp_kelvin,
				maxTemperature: attributes?.max_color_temp_kelvin
			}
		}
	];

	$: if (picker && !interacting) {
		// Layout
		if (tempSelected) {
			picker.setOptions({ layout: temperatureLayout });
		} else if (colorSelected) {
			picker.setOptions({ layout: colorLayout });
		}
	}

	$: if (picker && !interacting) {
		// Color or Temperature — only sync when the HA value actually changes,
		// not just because interacting flipped, to avoid reverting optimistic position
		if (colorMode === 'xy' && rgbColor && rgbColor !== prevRgbColor) {
			prevRgbColor = rgbColor;
			picker.color.rgb = {
				r: rgbColor[0],
				g: rgbColor[1],
				b: rgbColor[2]
			};
		} else if (
			colorMode === 'color_temp' &&
			colorTempKelvin &&
			colorTempKelvin !== prevColorTempKelvin
		) {
			prevColorTempKelvin = colorTempKelvin;
			picker.color.kelvin = colorTempKelvin;
		}
	}

	onMount(async () => {
		picker = iro.ColorPicker(element, {
			width: 275,
			color: `rgb(${rgbColor || '255, 255, 255'})`,
			handleRadius: 20,
			wheelLightness: false,
			borderWidth: 3,
			layoutDirection: 'horizontal',
			layout: colorMode === 'xy' ? colorLayout : temperatureLayout
		});

		// init
		picker.on('input:start', () => {
			clearTimeout(timeout);
			setHandleTransition(`all ${$motion}ms ease`);
			interacting = true;
		});

		// on input logic
		picker.on('input:change', handleChange);

		// don't transition handle when dragging
		picker.on('input:move', () => setHandleTransition('none'));

		picker.on('input:end', (event: any) => {
			// remove displayed kelvin and reset transition
			kelvinNumber = undefined;
			setHandleTransition(`all ${$motion}ms ease`);

			// make sure to send a final request so last doesn't get ignored
			request = undefined;
			handleChange(event);

			// debounce for one sec
			timeout = setTimeout(() => {
				interacting = false;
			}, 1000);
		});
	});

	async function handleChange(color: { rgb: { r: number; g: number; b: number }; kelvin: number }) {
		kelvinNumber = Math.round(color?.kelvin);
		if (request) return;

		let data;

		if (tempSelected && supportedColorModes?.includes('color_temp')) {
			data =
				attributes?.min_color_temp_kelvin !== undefined
					? { color_temp_kelvin: Math.round(color?.kelvin) }
					: { color_temp: Math.round(1000000 / color?.kelvin) };
		} else if (colorSelected) {
			data = {
				rgb_color: [color.rgb.r, color.rgb.g, color.rgb.b]
			};
		}

		if (!data) return;

		request = callService($connection, 'light', 'turn_on', {
			entity_id: entity?.entity_id,
			...data
		});

		try {
			await request;
		} catch (error) {
			console.error('Failed to update color or temperature:', error);
		} finally {
			request = undefined;
		}
	}

	function setHandleTransition(value: string) {
		const handle: SVGElement | null = element.querySelector('svg.IroHandle');
		if (handle) handle.style.transition = value;
	}

	onDestroy(() => {
		clearTimeout(timeout);
		timeout = undefined;
	});
</script>

<div
	bind:this={element}
	style:margin-top={supportedColorModes?.length !== 1 ? '2em' : '0'}
	style:opacity={entity?.state === 'off' ? '0.25' : 'unset'}
	style:transition="all {$motion}ms ease"
></div>

{#if tempSelected && kelvinNumber && interacting}
	<span
		in:fade={{ duration: $motion / 2 }}
		out:fade={{ duration: $motion / 2, delay: $motion * 2 }}
	>
		{kelvinNumber}K
	</span>
{/if}

<style>
	div {
		display: flex;
		justify-content: center;
	}

	span {
		position: absolute;
		bottom: 2.5rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 1.2rem;
	}
</style>
