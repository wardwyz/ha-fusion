<script lang="ts">
	import ComputeIcon from '$lib/Components/ComputeIcon.svelte';
	import StateLogic from '$lib/Components/StateLogic.svelte';
	import {
		connection,
		editMode,
		itemHeight,
		lang,
		onStates,
		climateHvacActionToMode,
		ripple,
		states,
		templates,
		config
	} from '$lib/Stores';
	import { getDomain, getName, getTogglableService, openEntityModal } from '$lib/Utils';
	import Icon, { loadIcon } from '@iconify/svelte';
	import { callService, type HassEntity } from 'home-assistant-js-websocket';
	import { marked } from 'marked';
	import { onDestroy } from 'svelte';
	import { openModal, closeModal } from 'svelte-modals';
	import Ripple from 'svelte-ripple';
	import parser from 'js-yaml';
	import '$lib/Main/Button.css';

	export let demo: string | undefined = undefined;
	export let sel: any;
	export let sectionName: string | undefined = undefined;

	$: entity_id = demo || sel?.entity_id;
	$: template = $templates?.[sel?.id];
	$: icon = (sel?.template?.icon && template?.icon?.output) || sel?.icon;
	$: color = (sel?.template?.color && template?.color?.output) || sel?.color;
	$: marquee = sel?.marquee;
	$: more_info = sel?.more_info;
	$: displayOnly = sel?.display_only;

	let entity: HassEntity;
	let contentWidth: number;
	let container: HTMLDivElement;
	let stateOn: boolean;
	let optimisticState: boolean | null = null;
	let optimisticTimeout: ReturnType<typeof setTimeout> | null = null;

	$: displayStateOn = optimisticState ?? stateOn;

	// Light drag slider
	let isDragging = false;
	let wasDragging = false;
	let pointerIsDown = false;
	let dragStartX = 0;
	let dragBrightness = 0;
	let showDragOverlay = false;
	$: isLight = getDomain(sel?.entity_id) === 'light';
	$: lightBrightness = entity?.attributes?.brightness ?? 0;
	$: dragOverlayColor = `color-mix(in srgb, ${iconColor} 60%, transparent)`;

	/**
	 * Observes changes in the `last_updated` property of an entity.
	 * When the `last_updated` property changes:
	 *
	 * - Updates `entity` with the new state from `$states`
	 * - Clears optimistic state and resets the UI to real entity state
	 * - Clears any pending optimistic revert timeout
	 */
	$: if (entity_id && $states?.[entity_id]?.last_updated !== entity?.last_updated) {
		entity = $states?.[entity_id];

		optimisticState = null;

		if (optimisticTimeout) {
			clearTimeout(optimisticTimeout);
			optimisticTimeout = null;
		}
	}

	$: attributes = entity?.attributes;

	$: iconColor = color
		? color
		: attributes?.hs_color
			? `hsl(${attributes?.hs_color}%, 50%)`
			: 'rgb(75, 166, 237)';

	// icon is image if extension, e.g. test.png
	$: image = icon?.includes('.');

	$: if (sel?.template?.set_state && template?.set_state?.output) {
		// template
		stateOn = $onStates?.includes(template?.set_state?.output?.toLocaleLowerCase());
	} else if (attributes?.hvac_action) {
		// climate
		stateOn = $onStates?.includes(
			$climateHvacActionToMode?.[attributes?.hvac_action]?.toLocaleLowerCase()
		);
	} else if (attributes?.in_progress) {
		// update
		stateOn = typeof attributes.in_progress === 'number';
	} else {
		// default
		stateOn = $onStates?.includes(entity?.state?.toLocaleLowerCase());
	}

	/**
	 * Toggles the state of the specified entity
	 * using the correct service call...
	 */
	function toggle() {
		// if service template
		if (sel?.template?.service && template?.service?.output) {
			try {
				// template is string, try to parse it
				const _template = parser.load(template?.service?.output) as {
					service: string;
					data: Record<string, unknown>;
				};

				if (_template?.service) {
					const [domain, service] = _template.service.split('.');
					callService($connection, domain, service, _template?.data);
				}
			} catch (error) {
				console.error('Template service YAML parse error:', error);
			}

			return;
		}

		// default
		const service = getTogglableService(entity);

		if (service && sel?.confirm) {
			openModal(() => import('$lib/Modal/ConfirmAlert.svelte'), {
				title: getName(sel, entity, sectionName) || $lang('unknown'),
				message: $lang('confirm_action'),
				confirm: () => {
					closeModal();
					performToggle(service);
				},
				cancel: () => closeModal()
			});
		} else if (service) {
			performToggle(service);
		} else {
			// not in getTogglableService just open modal
			handleClickEvent();
		}
	}

	function performToggle(service: string) {
		// use returned domain to handle specific cases such
		// as 'remote', which uses 'homeassistant.toggle'
		const [_domain, _service] = service.split('.');
		callService($connection, _domain, _service, {
			entity_id
		});

		// optimistic flip, reverted by the entity-update watcher above
		// or after 5s if Home Assistant never confirms
		optimisticState = !stateOn;
		if (optimisticTimeout) clearTimeout(optimisticTimeout);
		optimisticTimeout = setTimeout(() => {
			optimisticState = null;
		}, 5000);
	}

	/**
	 * Delegate to handleEvent
	 */
	function handlePointer() {
		handleEvent({ type: 'preload' });
	}

	/**
	 * handleEvent
	 * pointerenter | pointerdown | click
	 */
	async function handleEvent(event: any) {
		if (event.type === 'click') {
			await handleClickEvent();
		} else {
			await handlePointerEvent();
		}
	}

	/**
	 * Handle click events
	 * Opens modal for specified domain
	 */
	async function handleClickEvent() {
		if ($editMode) {
			openModal(() => import('$lib/Modal/ButtonConfig.svelte'), {
				demo: entity_id,
				sel,
				sectionName
			});
		} else if (more_info === false) {
			toggle();
		} else {
			await openEntityModal(sel?.entity_id, sel);
		}
	}

	/**
	 * Preloads module before click event
	 */
	async function handlePointerEvent() {
		if ($editMode) {
			await import('$lib/Modal/ButtonConfig.svelte');
		} else {
			switch (getDomain(sel?.entity_id)) {
				case 'light':
					await import('$lib/Modal/LightModal.svelte');
					break;
				case 'switch':
					await import('$lib/Modal/SwitchModal.svelte');
					break;
				case 'climate':
					await import('$lib/Modal/ClimateModal.svelte');
					break;
				case 'media_player':
					await import('$lib/Modal/MediaPlayer.svelte');
					break;
				default:
					await import('$lib/Modal/Unknown.svelte');
					break;
			}
		}
	}

	/**
	 * Light drag slider — pointerdown
	 * Unifica handlePointer e drag start
	 */
	function handlePointerDown(event: MouseEvent) {
		handlePointer();
		const e = event as unknown as PointerEvent;
		if (!isLight || $editMode || entity?.state !== 'on') return;
		pointerIsDown = true;
		dragStartX = e.clientX;
		dragBrightness = lightBrightness;
	}

	/**
	 * Light drag slider — pointermove
	 * Attiva la modalità drag dopo 8px di spostamento
	 */
	function handleDragMove(event: MouseEvent) {
		if (!pointerIsDown || !isLight || $editMode || entity?.state !== 'on') return;
		const e = event as unknown as PointerEvent;
		const deltaX = e.clientX - dragStartX;
		if (!isDragging && Math.abs(deltaX) > 15) {
			isDragging = true;
			showDragOverlay = true;
		}
		if (isDragging) {
			const rect = container.getBoundingClientRect();
			const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
			dragBrightness = Math.round(pct * 255);
		}
	}

	/**
	 * Light drag slider — pointerup
	 * Se era drag, aggiorna brightness. Altrimenti lascia passare il click.
	 */
	function handleDragEnd(event: MouseEvent) {
		if (!isLight || $editMode) return;
		if (isDragging) {
			callService($connection, 'light', 'turn_on', {
				entity_id: entity?.entity_id,
				brightness: dragBrightness
			});
			wasDragging = true;
			event.stopPropagation();
		}
		pointerIsDown = false;
		isDragging = false;
		showDragOverlay = false;
	}

	function handleDragCancel() {
		pointerIsDown = false;
		isDragging = false;
		wasDragging = false;
		showDragOverlay = false;
	}

	////// templates //////

	$: if ($config?.state === 'RUNNING' && sel?.template) {
		// for each changed entry in template
		Object.entries(sel?.template as Record<string, string>).forEach(([key, value]) => {
			const compareTemplate = value === template?.[key]?.input;
			const compareEntityId = sel?.entity_id === template?.[key]?.entity_id;
			if (compareTemplate && compareEntityId) return;
			renderTemplate(key, value);
		});
	}

	let unsubscribe: () => void;

	async function renderTemplate(key: string, value: string) {
		if (!$connection || !sel?.id) return;

		try {
			unsubscribe = await $connection.subscribeMessage(
				(response: { result: string } | { error: string; level: 'ERROR' | 'WARNING' }) => {
					let data: any = {
						input: value
					};

					if ('result' in response) {
						data.output =
							key === 'state' || key === 'name'
								? marked.parseInline(String(response.result))
								: String(response.result);
					} else if (response?.level === 'ERROR') {
						console.error(response.error);
						data.error = response.error;
					}

					data.entity_id = sel?.entity_id;

					$templates[sel?.id] = { ...$templates[sel?.id], [key]: data };
				},
				{
					type: 'render_template',
					template: value,
					report_errors: true,
					variables: {
						entity_id: sel?.entity_id
					}
				}
			);
		} catch (error) {
			console.error('Template error:', error);
		}
	}

	onDestroy(() => unsubscribe?.());

	// Timer countdown
	let timerInterval: ReturnType<typeof setInterval>;
	let timerDisplay: string;
	let timerCurrentDate = new Date();
	$: timerFinishesAt = attributes?.finishes_at;
	$: timerEnd = new Date(timerFinishesAt);
	$: if (sel?.show_timer && getDomain(sel?.entity_id) === 'timer' && timerFinishesAt)
		initTimerInterval();

	function initTimerInterval() {
		clearInterval(timerInterval);
		updateTimerDisplay();
		timerInterval = setInterval(updateTimerDisplay, 1000);
	}

	function updateTimerDisplay() {
		timerCurrentDate.setTime(Date.now());
		const diff = timerEnd.getTime() - timerCurrentDate.getTime();
		if (diff > 0) timerDisplay = formatTimer(...calculateTimerParts(diff));
	}

	function calculateTimerParts(ms: number): [number, number, number] {
		const h = Math.floor(ms / (1000 * 60 * 60));
		const m = Math.floor((ms / (1000 * 60)) % 60);
		const s = Math.floor((ms / 1000) % 60);
		return [h, m, s];
	}

	function formatTimer(h: number, m: number, s: number): string {
		return h
			? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
			: m
				? `${m}:${String(s).padStart(2, '0')}`
				: `0:${String(s).padStart(2, '0')}`;
	}

	function parseTimerRemaining(timeString: string): [number, number, number] {
		const parts = timeString.split(':').map(Number);
		while (parts.length < 3) parts.unshift(0);
		return parts as [number, number, number];
	}

	onDestroy(() => clearInterval(timerInterval));
</script>

<div
	class="container"
	bind:this={container}
	data-state={displayStateOn}
	tabindex="-1"
	style={!$editMode && !displayOnly ? 'cursor: pointer;' : ''}
	style:touch-action={isLight && !$editMode && !displayOnly && entity?.state === 'on'
		? 'none'
		: 'auto'}
	style:min-height="{$itemHeight}px"
	on:pointerenter={!displayOnly || $editMode ? handlePointer : undefined}
	on:pointerdown={!displayOnly || $editMode ? handlePointerDown : undefined}
	on:pointermove={!displayOnly || $editMode ? handleDragMove : undefined}
	on:pointerup={!displayOnly || $editMode ? handleDragEnd : undefined}
	on:pointercancel={!displayOnly || $editMode ? handleDragCancel : undefined}
	use:Ripple={{
		...$ripple,
		color:
			!$editMode && !displayOnly
				? displayStateOn
					? 'rgba(0, 0, 0, 0.25)'
					: 'rgba(255, 255, 255, 0.15)'
				: 'rgba(0, 0, 0, 0)'
	}}
>
	<!-- DRAG OVERLAY (solo per luci) -->
	{#if showDragOverlay}
		<div
			class="drag-overlay"
			style="width: {Math.round(dragBrightness / 2.55)}%; --drag-overlay-color: {dragOverlayColor}"
		/>
	{/if}

	<!-- ICON -->

	<div
		class="left"
		on:click|stopPropagation={(event) => {
			if (wasDragging) {
				wasDragging = false;
				return;
			}
			if (isDragging) return;
			if ($editMode) {
				handleEvent(event);
			} else if (!displayOnly) {
				toggle();
			}
		}}
		on:keydown
		role="button"
		tabindex="0"
	>
		<div
			class="icon"
			data-state={displayStateOn}
			style:--icon-color={iconColor}
			style:background-color={sel?.template?.color && template?.color?.output
				? template?.color?.output
				: undefined}
			style:background-image={!icon && attributes?.entity_picture
				? `url(${attributes?.entity_picture})`
				: image && icon
					? `url(${icon})`
					: 'none'}
			class:image
		>
			{#if image || (!icon && attributes?.entity_picture)}
				&nbsp;
			{:else if icon}
				{#await loadIcon(icon)}
					<!-- loading -->
					<Icon icon="ooui:help-ltr" height="none" width="100%" />
				{:then resolvedIcon}
					<!-- exists -->
					<Icon icon={resolvedIcon} height="none" width="100%" />
				{:catch}
					<!-- doesn't exist -->
					<Icon icon="ooui:help-ltr" height="none" width="100%" />
				{/await}
			{:else if entity_id}
				<ComputeIcon {entity_id} />
			{:else}
				<Icon icon="ooui:help-ltr" height="none" width="100%" />
			{/if}
		</div>
	</div>

	<div
		class="right"
		on:click|stopPropagation={(e) => {
			if (wasDragging) {
				wasDragging = false;
				return;
			}
			if (!isDragging && (!displayOnly || $editMode)) handleEvent(e);
		}}
		on:keydown
		role="button"
		tabindex="0"
	>
		<!-- NAME -->
		<div class="name" data-state={displayStateOn}>
			{@html (sel?.template?.name && template?.name?.output) ||
				getName(sel, entity, sectionName) ||
				$lang('unknown')}
		</div>

		<!-- STATE -->

		<!-- only bind clientWidth if marquee is set and use svelte-fast-dimension -->
		<div class="state" data-state={displayStateOn}>
			{#if marquee}
				<div style="width: min-content;" bind:clientWidth={contentWidth}>
					{#if sel?.show_timer && getDomain(sel?.entity_id) === 'timer'}
						{#if entity?.state === 'active'}
							{timerDisplay || '--:--'}
						{:else if entity?.state === 'paused' && attributes?.remaining}
							{formatTimer(...parseTimerRemaining(attributes.remaining))}
						{:else if entity?.state === 'idle' && attributes?.duration}
							{formatTimer(...parseTimerRemaining(attributes.duration))}
						{:else}
							--:--
						{/if}
					{:else if sel?.state || (sel?.template?.state && template?.state?.output)}
						{@html sel?.state || template?.state?.output}
					{:else if sel?.template?.set_state && template?.set_state?.output}
						{@html sel?.template?.set_state && $lang(template?.set_state?.output)}
					{:else}
						<StateLogic {entity_id} selected={sel} {contentWidth} />
					{/if}
				</div>
			{:else}
				<div style="overflow: hidden; text-overflow: ellipsis;">
					{#if sel?.show_timer && getDomain(sel?.entity_id) === 'timer'}
						{#if entity?.state === 'active'}
							{timerDisplay || '--:--'}
						{:else if entity?.state === 'paused' && attributes?.remaining}
							{formatTimer(...parseTimerRemaining(attributes.remaining))}
						{:else if entity?.state === 'idle' && attributes?.duration}
							{formatTimer(...parseTimerRemaining(attributes.duration))}
						{:else}
							--:--
						{/if}
					{:else if sel?.state || (sel?.template?.state && template?.state?.output)}
						{@html sel?.state || template?.state?.output}
					{:else if sel?.template?.set_state && template?.set_state?.output}
						{@html sel?.template?.set_state && $lang(template?.set_state?.output)}
					{:else}
						<StateLogic {entity_id} selected={sel} {contentWidth} />
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.container {
		background-color: var(--theme-button-background-color-off);
		font-family: inherit;
		width: 100%;
		height: 100%;
		display: grid;
		border-radius: 0.65rem;
		margin: 0;
		grid-template-columns: min-content auto;
		grid-auto-flow: row;
		grid-template-areas: 'left right';
		--container-padding: 0.72rem;

		/* fix ripple */
		transform: translateZ(0);
		overflow: hidden;
	}

	.image {
		background-size: cover;
		background-repeat: no-repeat;
	}

	.left {
		display: inherit;
		padding: var(--container-padding);
	}

	.right {
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		padding-right: var(--container-padding);
	}

	.icon {
		--icon-size: 2.4rem;
		grid-area: icon;
		height: var(--icon-size);
		width: var(--icon-size);
		color: rgb(200 200 200);
		background-color: rgba(0, 0, 0, 0.25);
		border-radius: 50%;
		display: grid;
		align-items: center;
		display: flex;
		padding: 0.5rem;
		background-position: center center;
		background-size: cover;
		background-repeat: no-repeat;
	}

	.name {
		grid-area: name;
		font-weight: 500;
		color: inherit;
		white-space: nowrap;
		color: var(--theme-button-name-color-off);
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.95rem;
		margin-top: -1px;
	}

	.state {
		grid-area: state;
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--theme-button-state-color-off);
		font-size: 0.925rem;
		margin-top: 1px;
	}

	.container[data-state='true'] {
		background-color: var(--theme-button-background-color-on);
	}

	.icon[data-state='true'] {
		color: white;
		background-color: var(--icon-color);
	}

	.name[data-state='true'] {
		color: var(--theme-button-name-color-on);
	}

	.state[data-state='true'] {
		color: var(--theme-button-state-color-on);
	}

	/* Phone and Tablet (portrait) */
	@media all and (max-width: 768px) {
		.container {
			width: calc(50vw - 1.45rem);
		}
	}
</style>
