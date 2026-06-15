<script lang="ts">
	import { dashboard, record, lang, motion, ripple, states, connection, demo } from '$lib/Stores';
	import { openModal, closeModal } from 'svelte-modals';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import InputClear from '$lib/Components/InputClear.svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import type { SidebarItem } from '$lib/Types';
	import {
		getGraphEntity,
		getSensorEntity,
		getPercentageEntity,
		getCameraEntity,
		getTimerEntity,
		getHistoryEntity,
		getWeatherEntity,
		getWeatherForecastEntity
	} from '$lib/Modal/getRandomEntity';

	import AiAssistant from '$lib/Sidebar/AiAssistant.svelte';
	import Bar from '$lib/Sidebar/Bar.svelte';
	import BinarySensor from '$lib/Sidebar/BinarySensor.svelte';
	import Sensor from '$lib/Sidebar/Sensor.svelte';
	import Time from '$lib/Sidebar/Time.svelte';
	import Date from '$lib/Sidebar/Date.svelte';
	import Weather from '$lib/Sidebar/Weather.svelte';
	import WeatherForecast from '$lib/Sidebar/WeatherForecast.svelte';
	import Image from '$lib/Sidebar/Image.svelte';
	import Camera from '$lib/Main/Camera.svelte';
	import History from '$lib/Sidebar/History.svelte';
	import Graph from '$lib/Sidebar/Graph.svelte';
	import Template from '$lib/Sidebar/Template.svelte';
	import Timer from '$lib/Sidebar/Timer.svelte';
	import Notifications from '$lib/Sidebar/Notifications.svelte';
	import PowerSummary from '$lib/Sidebar/PowerSummary.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Radial from '$lib/Sidebar/Radial.svelte';
	import Ripple from 'svelte-ripple';
	import Icon from '@iconify/svelte';

	export let isOpen: boolean;
	export let sel: SidebarItem;

	let searchString = '';
	let searchElement: HTMLInputElement;
	let modalTransitionEnd = false;

	// get random preview entities
	if (!$demo.graph) getGraphEntity($states, connection, (id) => ($demo.graph = id));
	if (!$demo.sensor) $demo.sensor = getSensorEntity($states);
	if (!$demo.timer) $demo.timer = getTimerEntity($states);
	if (!$demo.bar) $demo.bar = getPercentageEntity($states);
	if (!$demo.radial) $demo.radial = getPercentageEntity($states);
	if (!$demo.camera) $demo.camera = getCameraEntity($states);
	if (!$demo.history) $demo.history = getHistoryEntity($states);
	if (!$demo.weather) $demo.weather = getWeatherEntity($states);
	if (!$demo.weather_forecast) $demo.weather_forecast = getWeatherForecastEntity($states);

	const imageData =
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M100 100H0V0h100v100zM37.1 77.8v3.7h3.7v7.4h-3.7v-3.6h-3.6v11.1h3.7v-3.7h7.4V89h11.1v-3.7h0 7.4 0V89h-3.7v3.7h-3.7v3.7h3.7v-3.7h3.7v3.7h11.1v-3.7h7.4v3.7h3.7v-3.7h-3.7V89h3.7v-3.7H89V89h7.4v-3.7h-3.6v-7.4h3.6V66.8h-3.7v-3.7H89v3.7h3.7v7.4H89v7.4h-3.7v3.7h-3.7V63.1h3.7v-3.7H89v-3.7h3.7v3.7h3.6v-11h-3.7v3.7h-3.7v3.7h-7.4v3.7h-7.4v-3.7h3.7V44.7h-3.7v3.7h-3.7V41h0 7.4v-3.7h3.7v11.1h3.7v-3.7h3.7V41h3.7v3.7h3.7v-11H89v7.4h-3.7v-3.7h-3.7v-3.7H63.1V30h3.7v-7.4h-3.7V30h-3.7V18.9h3.7v-3.7h-3.7v3.7h-3.7v-7.4h3.7V4.1h-3.7v7.4H52V4.1h-7.4v3.7h0-7.4V4.1h-3.6v7.4h7.3v7.4h-7.4v2.7 23.2h-3.7v-3.7h-3.7v-3.7h3.7v-3.7h-7.4v7.4H15v.6 8.8 1.8h-3.7V41.2H7.6v-3.7H15v-3.7H3.9v7.4h3.7v3.7H3.9v7.4h7.4V56H3.9v3.7h7.3V56h3.7v-3.7h3.7v-7.4h3.7v-3.7H26v3.7h3.7v3.7H26v3.7h-3.7v7.4h-3.7v3.7H3.8v3.7h18.5v-3.7H26v3.7h7.4 0v3.7h11.1v11.1h-3.7v-3.7c-1.3-.4-2.5-.4-3.7-.4v-3.6h-3.7v3.6h3.7zm-7.5-48.2V3.7H3.7v25.9h25.9zM96.3 3.7H70.4v25.9h25.9V3.7zM29.6 70.4H3.7v25.9h25.9V70.4zm37-59.3V7.5H63v3.6h3.6zm29.7 81.5h-3.7v3.6h3.7v-3.6z' /%3E%3Cg fill='%23fff'%3E%3Cpath d='M74.1 59.3h7.4v-3.7h7.4 0v3.7h-3.7V63h-3.7v22.2h3.7v3.7h-3.7v3.7h0-7.4v3.7H63v-3.7h-3.7 0v-3.7H63v-3.7h3.7v-3.7H63v3.7h-7.4v-3.7h3.7v-7.4H63v-7.4h-3.7V63h-3.7v-3.6H44.5v3.7h3.7v11.1h3.7v3.7h-3.7v7.4h7.4V89H44.5v3.7h-7.4v3.7h-3.7V85.3H37v3.6h3.7v-7.4h0 3.7V70.4H33.3v-3.7H37V63h3.7v-3.7H37V63h-3.7v3.7h-7.4V63h0 3.7v-3.7h0 3.7v-3.7h11.1V40.8h0 3.7v3.7h3.7v3.7h-3.7v7.4h11.1v-3.7h3.7 0v3.7h3.7 0v3.7h-3.7v3.6H74c.1-1.2.1-2.4.1-3.6h0zm-3.7 29.6h3.7v-3.7h3.7v-3.7h-7.4v7.4h-3.7v3.7h3.7v-3.7zm7.4-22.2h-11v11.1h11V66.7zM33.3 44.5V21.3v-2.7h7.4v-7.4h-7.3V3.8H37v3.7h7.4v3.7h3.7V7.5h-3.7V3.8h7.4v7.4h3.7 0v7.4h-3.7v-3.7h-7.3v3.7h3.7v1.6V26h-3.7v-3.7h-7.4v11h3.7v-7.4h3.7v3.7h3.7v-3.7h3.7 0V37h-3.7v-3.7h-3.7v7.4h0-7.4v3.7h0l-3.8.1h0zm-3.7-14.9H3.7V3.7h25.9v25.9zM7.4 25.9h18.5V7.4H7.4v18.5zM96.3 3.7v25.9H70.4V3.7h25.9zM74.1 25.9h18.5V7.4H74.1v18.5zM29.6 70.4v25.9H3.7V70.4h25.9zM7.4 74.1v18.5h18.5V74.1H7.4z' /%3E%3Cpath d='M63 29.6v3.7h18.5V37h0-3.7v3.7h-7.4V37h-3.7v3.7h3.7v7.4h-3.7v3.7h0H63h0v-3.7h-7.4v-3.7h3.7V33.3h-3.7v-7.4h-3.7 0v-3.7h3.7v-3.7h3.7 0v11.1H63h0zM25.9 63h-3.7v3.7H3.7V63h14.8v-3.7h3.7v-7.4h3.7 0v3.7h3.7v3.7h0-3.7V63h0zm66.7 3.7h3.7v11.1h-3.6v7.4h3.6v3.7h-7.4v-3.7h-3.7v-3.7h3.7v-7.4h3.7v-7.4h0zM70.4 48.2h3.7v-3.7h3.7v11.1h-3.7v3.7h0-3.7v-3.7h-3.7 0v-3.7h0 3.7v-3.7h0zm-59.3 3.6H3.7v-7.4h3.7v-3.7h0 3.7v11.1h0zm77.8-11v-7.4h7.3v11h-3.7v-3.7c-1.1.1-2.4.1-3.6.1 0-.1 0 0 0 0z' /%3E%3Cpath d='M81.5 37h3.7v3.7h3.7v3.7h-3.7v3.7h-3.7V37zM14.8 51.9v-1.8-8.8-.6h7.4 0v3.7h-3.7v7.4c-1.2.1-2.4.1-3.7.1zm74.1 3.7v-3.7h3.7v-3.7h3.7v11h-3.6v-3.7l-3.8.1zM7.4 40.7H3.7v-7.4h11.1V37H7.4v3.7z' /%3E%3Cpath d='M22.2 40.7v-7.4h7.4V37h-3.7v3.7h-3.7zm33.4-29.6V3.7h3.7v7.4h-3.7c-.1 0 0 0 0 0zM63 29.6v-7.4h3.7v7.4H63zM11.1 55.5v3.7H3.8v-3.7h7.3z' /%3E%3Cpath d='M11.1 51.9h3.7v3.7h-3.7v-3.7c0-.1 0 0 0 0zm81.5 14.8h-3.7V63h3.7v3.7zM25.9 51.9v-3.7h3.7 0v3.7c-1.2-.1-2.5-.1-3.7 0h0zm33.4-33.4v-3.7H63v3.7h-3.7z' /%3E%3Cpath d='M29.6 48.2v-3.7h0 3.7 0v3.7c-1.2-.1-2.5-.1-3.7 0h0zm37-37.1H63V7.5h3.6v3.6zM37.1 77.8h-3.7v-3.6h3.7a21.6 21.6 0 0 0 0 3.6c-.1 0 0 0 0 0z' /%3E%3Cpath d='M40.7 81.5H37v-3.7h3.7v3.7zM29.6 44.4h-3.7v-3.7h3.7v3.7c0 .1 0 0 0 0zm29.7 48.2v3.7h-3.7v-3.7h3.7zm22.2 0h3.7v3.7h-3.7v-3.7zm14.8 0v3.6h-3.7v-3.6h3.7z' /%3E%3C/g%3E%3Cpath d='M29.6 48.1h3.7v-3.7H37v7.4h3.7v-7.4H37v-3.7h7.4v14.8H33.3v3.7h-3.7v-3.7h-3.7v-3.7h3.7v-3.7zm26 37.1h-7.4v-7.4h3.7v-3.7h0 3.7v-3.7h0 3.7v-3.7h0H63v7.4h-3.7v7.4h-3.7v3.7z' /%3E%3Cpath d='M51.9 74.1h-3.7V63h-3.7v-3.7h11.1v3.6h3.7v3.7h-3.7v3.7h0-3.7c-.1 1.3-.1 2.6 0 3.8h0zm25.9-7.4v11.1h-11V66.7h11zm-3.7 3.7h-3.6V74h3.6v-3.6zm-18.6-26v3.7h7.4v3.7h-3.7v3.7H48.1v-7.4h3.7v-3.7c1.3.1 2.5.1 3.7 0h0z' /%3E%3Cpath d='M44.4 40.7v-7.4h3.7V37h3.7v7.4h-3.7v-3.7h-3.7zm22.3 14.8h3.7v3.7h3.7v3.7H63v-3.6h3.7v-3.8zm3.7 33.4v-7.4h7.4v3.7h-3.7v3.7h-3.7 0z' /%3E%3Cpath d='M66.7 51.8v3.7H63v-3.7h3.7zM25.9 63v-3.7h3.7V63h-3.7zM37 63v-3.7h3.7V63H37h0z' /%3E%3Cpath d='M37 63v3.7h-3.7V63H37zm26 22.2v-3.7h3.7v3.7H63zm7.4 3.7v3.7h-3.7v-3.7h3.7zm-18.6-63h3.7v7.4h3.7v11.1h-3.7 0V37h-3.7c.1-3.7 0-7.4 0-11.1z' /%3E%3Cpath d='M55.6 18.5v3.7h-3.7v3.7h-3.7v-5.8-1.6h-3.7v-3.7h7.3v3.7h3.8zm-11.2 7.4h-3.7v7.4H37v-11h7.4v3.6h0z' /%3E%3Cpath d='M44.4 25.9h3.7v3.7h-3.7v-3.7zm0-18.5h3.7v3.7h-3.7V7.4zm-37 18.5V7.4h18.5v18.5H7.4zm14.8-14.8H11.1v11.1h11.1V11.1zm51.9 14.8V7.4h18.5v18.5H74.1zm3.7-14.8v11.1h11.1V11.1H77.8zm-70.4 63h18.5v18.5H7.4V74.1zm3.7 3.7v11.1h11.1V77.8H11.1zm59.3-29.7v3.7h-3.7v-3.7h3.7zm0-7.4h-3.7V37h3.7v3.7z' /%3E%3Cg fill='%23fff'%3E%3Cpath d='M37 44.5h3.7v7.4H37v-7.4c0-.1 0 0 0 0zm18.5 25.9v-3.7h3.7v3.7h-3.7z' /%3E%3Cpath d='M51.8 74.1v-3.7h3.7v3.7h-3.7zm22.3-3.7V74h-3.6v-3.6h3.6zM51.8 37h3.7v7.4h-3.7V37zM22.2 11.1v11.1H11.1V11.1h11.1zm55.6 0h11.1v11.1H77.8V11.1zM11.1 77.8h11.1v11.1H11.1V77.8z' /%3E%3C/g%3E%3C/svg%3E";

	onMount(() => {
		if (searchElement) {
			searchElement.focus();
		}

		// if changing type reset object
		if (sel) {
			(Object.keys(sel) as Array<keyof SidebarItem>).forEach((key) => {
				if (key !== 'id') {
					delete (sel as any)[key];
				}
			});
			sel.type = 'configure';
			$dashboard = $dashboard;
		}
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
		component?: any;
		props?: any;
		preview_icon?: string;
	}[];

	$: itemTypes = [
		{
			id: 'ai_assistant',
			type: $lang('ai_assistant'),
			component: AiAssistant,
			props: { sel: { type: 'ai_assistant' } }
		},
		{
			id: 'binary_sensor',
			type: $lang('binary_sensor'),
			component: BinarySensor,
			props: {
				demo: 'on',
				name: 'Porta ingresso',
				on_value: 'Aperta',
				off_value: 'Chiusa',
				icon_on: 'mdi:door-open',
				icon_off: 'mdi:door-closed',
				color_on: '#4fc3f7'
			}
		},
		{
			id: 'sensor',
			type: $lang('sensor'),
			component: Sensor,
			props: { demo: '23.5 °C' }
		},
		{
			id: 'template',
			type: $lang('template'),
			component: Template,
			props: { demo: true }
		},
		{
			id: 'divider',
			type: $lang('divider'),
			preview_icon: 'mdi:minus'
		},
		{
			id: 'bar',
			type: 'Bar',
			component: Bar,
			props: { demo: 72, name: 'Consumo' }
		},
		{
			id: 'notifications',
			type: 'Notifications',
			component: Notifications,
			props: { demo: true, sel: { expand: true } }
		},
		{
			id: 'time',
			type: $lang('time'),
			component: Time,
			props: { hour12: sel?.hour12 || false }
		},
		{
			id: 'camera',
			type: $lang('camera'),
			component: Camera,
			props: { demo: $demo.camera, sel, responsive: true, controls: false, muted: true }
		},
		{
			id: 'history',
			type: $lang('history'),
			component: History,
			props: { entity_id: $demo.history }
		},
		{
			id: 'image',
			type: $lang('picture'),
			component: Image,
			props: { url: imageData }
		},
		{
			id: 'iframe',
			type: $lang('iframe'),
			preview_icon: 'fontisto:world-o'
		},
		{
			id: 'graph',
			type: $lang('graph'),
			component: Graph,
			props: { entity_id: $demo.graph }
		},
		{
			id: 'date',
			type: $lang('date'),
			component: Date
		},
		{
			id: 'radial',
			type: 'Radial',
			component: Radial,
			props: { demo: 68, name: 'Radial' }
		},
		{
			id: 'weather',
			type: $lang('weather'),
			component: Weather,
			props: { sel: { ...sel, entity_id: $demo.weather } }
		},
		{
			id: 'weather_forecast',
			type: $lang('weather_forecast'),
			component: WeatherForecast,
			props: { sel: { ...sel, entity_id: $demo.weather_forecast } }
		},
		{
			id: 'navigate',
			type: $lang('navigate'),
			preview_icon: 'mdi:tab'
		},
		{
			id: 'timer',
			type: $lang('timer'),
			component: Timer,
			props: { sel: { ...sel, entity_id: $demo.timer } }
		},
		{
			id: 'power_summary',
			type: $lang('power_summary'),
			component: PowerSummary,
			props: { demo: true }
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
			case 'ai_assistant':
				openModal(() => import('$lib/Modal/AiAssistantConfig.svelte'), { sel });
				break;

			case 'binary_sensor':
				openModal(() => import('$lib/Modal/BinarySensorConfig.svelte'), { sel });
				break;

			case 'time':
				openModal(() => import('$lib/Modal/TimeConfig.svelte'), { sel });
				break;

			case 'date':
				openModal(() => import('$lib/Modal/DateConfig.svelte'), { sel });
				break;

			case 'divider':
				openModal(() => import('$lib/Modal/DividerConfig.svelte'), { sel });
				break;

			case 'sensor':
				openModal(() => import('$lib/Modal/SensorConfig.svelte'), {
					sel,
					demo: $demo.sensor
				});
				break;

			case 'weather':
				openModal(() => import('$lib/Modal/WeatherConfig.svelte'), {
					sel,
					demo: $demo.weather
				});
				break;

			case 'weather_forecast':
				openModal(() => import('$lib/Modal/WeatherForecastConfig.svelte'), {
					sel,
					demo: $demo.weather_forecast
				});
				break;

			case 'camera':
				openModal(() => import('$lib/Modal/CameraConfig.svelte'), {
					sel,
					demo: $demo.camera
				});
				break;

			case 'image':
				openModal(() => import('$lib/Modal/ImageConfig.svelte'), {
					sel,
					demo: imageData
				});
				break;

			case 'iframe':
				openModal(() => import('$lib/Modal/IframeConfig.svelte'), { sel });
				break;

			case 'history':
				openModal(() => import('$lib/Modal/HistoryConfig.svelte'), {
					sel,
					demo: $demo.history
				});
				break;

			case 'bar':
				openModal(() => import('$lib/Modal/BarConfig.svelte'), {
					sel,
					demo: $demo.bar
				});
				break;

			case 'navigate':
				openModal(() => import('$lib/Modal/NavigateConfig.svelte'), { sel });
				break;

			case 'notifications':
				openModal(() => import('$lib/Modal/NotificationsConfig.svelte'), { sel });
				break;

			case 'radial':
				openModal(() => import('$lib/Modal/RadialConfig.svelte'), {
					sel,
					demo: $demo.radial
				});
				break;

			case 'graph':
				openModal(() => import('$lib/Modal/GraphConfig.svelte'), {
					sel,
					demo: $demo.graph
				});
				break;

			case 'template':
				openModal(() => import('$lib/Modal/TemplateConfig.svelte'), { sel });
				break;

			case 'timer':
				openModal(() => import('$lib/Modal/TimerConfig.svelte'), {
					sel,
					demo: $demo.timer
				});
				break;

			case 'power_summary':
				openModal(() => import('$lib/Modal/PowerSummaryConfig.svelte'), { sel });
				break;

			default:
				openModal(() => import('$lib/Modal/SidebarItemConfig.svelte'), { sel });
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
	<Modal
		size="large"
		on:transitionend={() => {
			modalTransitionEnd = true;
		}}
	>
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
			{#each filter as { id, type, component, props, preview_icon } (id)}
				<button
					on:click={() => handleClick(id)}
					animate:flip={{ duration: $motion }}
					use:Ripple={$ripple}
				>
					<div class="preview" class:camera={id === 'camera'}>
						{#if component}
							<svelte:component this={component} {...props} />
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

	.search {
		margin: 1rem 0;
	}

	.camera {
		padding: 0.8rem 1rem;
		height: inherit;
	}

	.preview-icon {
		width: 3rem;
		opacity: 0.35;
		margin: auto;
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
