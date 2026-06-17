<script lang="ts">
	import { connection, editMode, lang, motion, ripple, states, timers } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { modals } from 'svelte-modals';
	import { callService, type HassEntity } from 'home-assistant-js-websocket';
	import { getName } from '$lib/Utils';

	export let sel: any;

	let interval: ReturnType<typeof setInterval>;
	let currentDate = new Date();
	let displayTime: string;
	let entity: HassEntity;

	let clicked = false;

	$: entity_id = sel?.entity_id;
	$: if (entity_id && $states?.[entity_id]?.last_updated !== entity?.last_updated) {
		entity = $states?.[entity_id];
	}

	$: state = entity?.state;
	$: attributes = entity?.attributes;
	$: finishes_at = attributes?.finishes_at;
	$: remaining = attributes?.remaining;
	$: end = new Date(finishes_at);
	$: if (end) init();
	$: service = state === 'active' ? 'pause' : 'start';

	// make pausedState global to sync across components
	$: if (state === 'paused' && remaining && !clicked) {
		timers.update((currentTimers) => {
			if (entity_id) {
				return {
					...currentTimers,
					[entity_id]: {
						...currentTimers[entity_id],
						pausedState: format(...parseRemaining(remaining))
					}
				};
			}
			return currentTimers;
		});
	}

	function init() {
		clearInterval(interval);
		update();
		interval = setInterval(update, 1000);
	}

	function update() {
		currentDate.setTime(Date.now());
		const diff = end.getTime() - currentDate.getTime();
		if (diff > 0) displayTime = calculate(diff);
	}

	function calculate(ms: number): string {
		const h = Math.floor(ms / (1000 * 60 * 60));
		const m = Math.floor((ms / (1000 * 60)) % 60);
		const s = Math.floor((ms / 1000) % 60);
		return format(h, m, s);
	}

	function format(h: number, m: number, s: number): string {
		return h
			? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
			: m
				? `${m}:${String(s).padStart(2, '0')}`
				: `0:${String(s).padStart(2, '0')}`;
	}

	function parseRemaining(timeString: string): [number, number, number] {
		const parts = timeString.split(':').map(Number);
		while (parts.length < 3) {
			parts.unshift(0);
		}
		return [parts[0], parts[1], parts[2]];
	}

	function handleClick(event: { stopPropagation: () => void }) {
		// set 'clicked' flag to prevent 'pausedState'
		// reactivity once interacted with at least once
		clicked = true;

		if (!$editMode) {
			event.stopPropagation();
			callService($connection, 'timer', service, { entity_id });

			// prevents flickering
			if (state === 'active') {
				// store current time when pausing
				timers.update((currentTimers) => {
					if (entity_id) {
						return {
							...currentTimers,
							[entity_id]: {
								...currentTimers[entity_id],
								pausedState: displayTime
							}
						};
					}
					return currentTimers;
				});
			}
		}
	}

	onDestroy(() => {
		clearInterval(interval);
	});
</script>

<div class="outer">
	<div
		class="container"
		style:pointer-events={$modals.length !== 0 ? 'none' : 'unset'}
		style:cursor={$editMode || $modals.length !== 0 ? 'unset' : 'pointer'}
		style:background-color={state === 'active' && entity_id ? 'rgba(0, 0, 0, 0.2)' : 'transparent'}
		style:transition="background-color {$motion}ms ease"
	>
		<div class="icon" style:color={finishes_at ? 'orange' : 'rgba(255, 255, 255, 0.5)'}>
			<Icon icon="ic:twotone-timer" height="none" />
		</div>

		<div class="column">
			<div class="name">
				{getName(sel, entity) || $lang('unknown')}
			</div>

			<div class="counter" style:color={finishes_at ? 'orange' : 'rgba(255, 255, 255, 0.5)'}>
				{#if state === 'active' && entity_id}
					{displayTime || $timers[entity_id].pausedState}
				{:else if state === 'paused' && entity_id}
					{$timers[entity_id].pausedState}
				{:else if state === 'idle' && attributes?.duration}
					{format(...parseRemaining(attributes.duration))}
				{:else}
					--:--
				{/if}
			</div>
		</div>

		{#if state}
			<button
				class="start_pause"
				style:cursor={$editMode ? 'unset' : 'pointer'}
				style:pointer-events={$modals.length !== 0 ? 'auto' : 'unset'}
				on:click={handleClick}
				use:Ripple={{
					...$ripple,
					opacity: $editMode ? '0' : $ripple.opacity
				}}
			>
				{#if state === 'active'}
					<Icon icon="ic:round-pause" height="none" />
				{:else}
					<Icon icon="ic:round-play-arrow" height="none" />
				{/if}
			</button>
		{/if}
	</div>
</div>

<style>
	.outer {
		padding: var(--theme-sidebar-item-padding);
	}

	.container {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.1);
		border-radius: 0.6rem;
		padding: 0.35rem 0.5rem;
	}

	.icon {
		flex-shrink: 0;
		width: 2.8rem;
		height: 2.8rem;
		display: flex;
		align-items: center;
	}

	.column {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		min-width: 0;
		line-height: 1.25;
	}

	.name {
		font-size: 0.8rem;
		font-weight: 600;
		opacity: 0.55;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.counter {
		font-size: 1.6rem;
		font-weight: 500;
	}

	.start_pause {
		flex-shrink: 0;
		width: 2.2rem;
		height: 2.2rem;
		background-color: var(--theme-navigate-background-color);
		border-radius: 50%;
		padding: 0.35rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
		border: none;
		cursor: pointer;
	}
</style>
