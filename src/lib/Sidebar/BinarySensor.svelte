<script lang="ts">
	import { states, editMode, motion, lang } from '$lib/Stores';
	import type { HassEntity } from 'home-assistant-js-websocket';
	import { getName } from '$lib/Utils';
	import Icon from '@iconify/svelte';

	export let entity_id: string | undefined = undefined;
	export let name: string | undefined = undefined;
	export let prefix: string | undefined = undefined;
	export let suffix: string | undefined = undefined;
	export let on_value: string | undefined = undefined;
	export let off_value: string | undefined = undefined;
	export let icon_on: string | undefined = undefined;
	export let icon_off: string | undefined = undefined;
	export let color_on: string | undefined = undefined;
	export let color_off: string | undefined = undefined;
	export let demo: 'on' | 'off' | undefined = undefined;

	let entity: HassEntity;

	$: if (entity_id && $states?.[entity_id]?.last_updated !== entity?.last_updated) {
		entity = $states?.[entity_id];
	}

	$: state = entity?.state;
	$: isOn = demo ? demo === 'on' : state === 'on';
	$: isUnavailable = demo ? false : ['unavailable', 'unknown'].includes(state);

	$: displayText = isUnavailable
		? $lang(state)
		: isOn
			? on_value || $lang('on')
			: off_value || $lang('off');

	// Priority: user config → HA entity icon → device_class → entity_id heuristics
	$: currentIcon = isOn
		? icon_on ||
			entity?.attributes?.icon ||
			getDeviceClassIcon(entity?.attributes?.device_class, true) ||
			getHeuristicIcon(entity_id, true)
		: icon_off ||
			entity?.attributes?.icon ||
			getDeviceClassIcon(entity?.attributes?.device_class, false) ||
			getHeuristicIcon(entity_id, false);

	$: currentColor = isUnavailable ? undefined : isOn ? color_on : color_off;

	function getDeviceClassIcon(deviceClass: string | undefined, on: boolean): string | undefined {
		if (!deviceClass) return undefined;
		const map: Record<string, [string, string]> = {
			door: ['mdi:door-open', 'mdi:door-closed'],
			garage_door: ['mdi:garage-open', 'mdi:garage'],
			window: ['mdi:window-open', 'mdi:window-closed'],
			motion: ['mdi:motion-sensor', 'mdi:motion-sensor-off'],
			occupancy: ['mdi:home-account', 'mdi:home-outline'],
			presence: ['mdi:home-account', 'mdi:home-outline'],
			smoke: ['mdi:smoke-detector-alert', 'mdi:smoke-detector'],
			lock: ['mdi:lock-open', 'mdi:lock'],
			connectivity: ['mdi:wifi', 'mdi:wifi-off'],
			power: ['mdi:power-plug', 'mdi:power-plug-off'],
			light: ['mdi:brightness-5', 'mdi:brightness-auto'],
			moisture: ['mdi:water', 'mdi:water-off'],
			battery: ['mdi:battery', 'mdi:battery-outline'],
			gas: ['mdi:molecule-co2', 'mdi:molecule-co2'],
			sound: ['mdi:music-note', 'mdi:music-note-off'],
			vibration: ['mdi:vibrate', 'mdi:vibrate-off'],
			cold: ['mdi:snowflake', 'mdi:snowflake-off'],
			heat: ['mdi:fire', 'mdi:fire-off'],
			plug: ['mdi:power-plug', 'mdi:power-plug-off'],
			problem: ['mdi:alert-circle', 'mdi:check-circle'],
			running: ['mdi:play-circle', 'mdi:stop-circle'],
			safety: ['mdi:shield-alert', 'mdi:shield-check'],
			tamper: ['mdi:alert', 'mdi:check'],
			update: ['mdi:package-up', 'mdi:package-check']
		};
		const entry = map[deviceClass];
		return entry ? entry[on ? 0 : 1] : undefined;
	}

	function getHeuristicIcon(id: string | undefined, on: boolean): string {
		if (!id) return on ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline';
		if (id.includes('door')) return on ? 'mdi:door-open' : 'mdi:door-closed';
		if (id.includes('window')) return on ? 'mdi:window-open' : 'mdi:window-closed';
		if (id.includes('motion') || id.includes('pir'))
			return on ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off';
		if (id.includes('presence') || id.includes('occupancy'))
			return on ? 'mdi:home-account' : 'mdi:home-outline';
		if (id.includes('smoke')) return on ? 'mdi:smoke-detector-alert' : 'mdi:smoke-detector';
		if (id.includes('lock')) return on ? 'mdi:lock-open' : 'mdi:lock';
		return on ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline';
	}
</script>

<div
	class="container"
	class:visible={!entity || state || $editMode || demo}
	style:padding-top={!entity || state || $editMode || demo ? '' : '0'}
	style:padding-bottom={!entity || state || $editMode || demo ? '' : '0'}
	style:transition="grid-template-rows {$motion}ms ease, padding {$motion}ms ease"
>
	<div class="expandable">
		<div class="card">
			<span class="icon" style:color={currentColor}>
				<Icon icon={currentIcon} height="none" />
			</span>
			<div class="body">
				<span class="label">
					{#if entity || demo}
						{getName({ name }, entity) || ''}
					{:else if entity_id}
						<span class="placeholder">{entity_id}</span>
					{:else}
						<span class="placeholder">{$lang('binary_sensor')}</span>
					{/if}
				</span>
				<span class="state">
					{#if displayText}
						{prefix || ''}{displayText}{suffix || ''}
					{:else}
						{$lang('unknown')}
					{/if}
				</span>
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		display: grid;
		grid-template-rows: 0fr;
		overflow: hidden;
		pointer-events: none;
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.1);
		padding: var(--theme-sidebar-item-padding);
	}

	.visible {
		grid-template-rows: 1fr;
	}

	.expandable {
		min-height: 0;
	}

	.card {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 0.6rem;
		padding: 0.55rem 0.75rem;
	}

	.icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		font-size: 1.35rem;
		width: 1.35rem;
		color: rgba(255, 255, 255, 0.75);
	}

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.label {
		font-size: 0.8rem;
		font-weight: 600;
		opacity: 0.55;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.state {
		font-size: 0.95rem;
		white-space: pre-line;
	}

	.placeholder {
		color: rgba(255, 255, 255, 0.25);
	}
</style>
