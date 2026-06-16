<script lang="ts">
	import {
		dashboard,
		configuration,
		editMode,
		motion,
		showDrawer,
		translation,
		drawerSearch,
		focusSearch,
		currentViewId,
		selectedLanguage,
		customJs,
		customCss,
		filterDashboard,
		disableMenuButton,
		clickOriginatedFromMenu,
		connection,
		youtubeAddon,
		states
	} from '$lib/Stores';
	import { authentication } from '$lib/Socket';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { modals, openModal } from 'svelte-modals';
	import Theme from '$lib/Components/Theme.svelte';
	import type { DoorbellItem } from '$lib/Types';

	/**
	 * Data from server-side load
	 * function +page.server.ts
	 */
	export let data;

	let altKeyPressed = false;
	let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

	function resetInactivityTimer() {
		if (inactivityTimer) {
			clearTimeout(inactivityTimer);
			inactivityTimer = null;
		}
		const defaultView = $dashboard?.views?.find((v) => v.is_default);
		if (!defaultView?.default_timeout || $editMode || $modals.length > 0) return;
		if ($currentViewId === defaultView.id) return;

		inactivityTimer = setTimeout(() => {
			$currentViewId = defaultView.id;
			inactivityTimer = null;
		}, defaultView.default_timeout * 1000);
	}

	$: $currentViewId, $editMode, $modals, resetInactivityTimer();

	// doorbell auto-trigger queue
	let doorbellQueue: DoorbellItem[] = [];
	const doorbellTriggered = new Map<number, boolean>();
	const doorbellQueueIds = new Set<number>();
	let doorbellItems: DoorbellItem[] = [];

	// recompute only when dashboard changes, not on every state update
	$: {
		doorbellItems = [];
		for (const view of $dashboard?.views ?? []) {
			for (const section of view.sections ?? []) {
				for (const item of (section as any).items ?? []) {
					if (item?.type === 'doorbell' && item?.trigger_entity) doorbellItems.push(item);
				}
				for (const nested of (section as any).sections ?? []) {
					for (const item of nested?.items ?? []) {
						if (item?.type === 'doorbell' && item?.trigger_entity) doorbellItems.push(item);
					}
				}
			}
		}
		// clean up stale map entries when items are removed
		const currentIds = new Set(doorbellItems.map((d) => d.id));
		for (const id of doorbellTriggered.keys()) {
			if (!currentIds.has(id)) doorbellTriggered.delete(id);
		}
	}

	function processDoorbellQueue() {
		if ($modals.length > 0 || doorbellQueue.length === 0 || $editMode) return;
		const next = doorbellQueue[0];
		doorbellQueue = doorbellQueue.slice(1);
		doorbellQueueIds.delete(next.id);
		openModal(() => import('$lib/Modal/DoorbellModal.svelte'), { sel: next, autoClose: true });
	}

	$: if ($states) {
		for (const item of doorbellItems) {
			const isOn = $states[item.trigger_entity!]?.state === 'on';
			const wasOn = doorbellTriggered.get(item.id) ?? false;
			if (isOn && !wasOn && !doorbellQueueIds.has(item.id)) {
				doorbellQueue = [...doorbellQueue, item];
				doorbellQueueIds.add(item.id);
			}
			doorbellTriggered.set(item.id, isOn);
		}
		processDoorbellQueue();
	}

	$: if ($modals.length === 0) processDoorbellQueue();

	$configuration = data?.configuration;
	$dashboard = data?.dashboard;
	$translation = data?.translations;
	$selectedLanguage = data?.configuration?.locale || 'en';
	$customJs = data?.configuration?.custom_js;
	$customCss = data?.configuration?.custom_css;
	$youtubeAddon = data?.configuration?.addons?.youtube;
	$currentViewId = $dashboard?.views?.[0]?.id;

	const _motion = data?.configuration?.motion;
	$motion = _motion === undefined || _motion === true ? $motion : 0;

	/**
	 * Computes the current view.
	 *
	 * filterDashboard is filtered from search input, else
	 * find `$currentViewId` OR when dragging get `isDndShadowItem`
	 */
	$: view = $drawerSearch
		? $filterDashboard
		: $dashboard?.views?.find((view) => view?.id === $currentViewId) ||
			$dashboard?.views?.find((view) => view?.isDndShadowItem);

	/**
	 * WebSocket, tries to reconnect if no previous connection has been made.
	 */
	let isConnecting = false;
	let retryInterval: ReturnType<typeof setInterval>;

	if (browser) {
		document.documentElement.lang = $selectedLanguage || 'en';

		connect();
		retryInterval = setInterval(connect, 3000);
	}

	async function connect() {
		if (isConnecting) return;
		isConnecting = true;

		console.debug('authenticating...');

		try {
			await authentication($configuration);
			console.debug('authenticated.');
			clearInterval(retryInterval);
		} catch {
			// catch but don't log
		} finally {
			isConnecting = false;
		}
	}

	/**
	 * Reconnect if long-lived access token changes
	 */
	$: if ($configuration?.token) updateConnection();

	function updateConnection() {
		if (isConnecting || !browser) return;
		clearInterval(retryInterval);

		connect();
		retryInterval = setInterval(connect, 3000);
	}

	onDestroy(() => clearInterval(retryInterval));

	onMount(async () => {
		/**
		 * If the "menu" parameter in the URL is set to 'false'
		 * Menu button is hidden and drawer is disabled.
		 */
		const menuParam = new URLSearchParams(window.location.search).get('menu');
		$disableMenuButton = menuParam === 'false';

		/**
		 * Unregister service worker because it
		 * interferes with MJPEG camera streams
		 */
		if ('serviceWorker' in navigator) {
			try {
				const registrations = await navigator.serviceWorker.getRegistrations();
				for (const registration of registrations) {
					await registration.unregister();
				}
			} catch (error) {
				console.error('Error during service worker unregistration:', error);
			}
		}
	});

	/**
	 * Toggles drawer visibility and resets
	 * the `$clickOriginatedFromMenu` flag.
	 */
	function toggleDrawer() {
		$showDrawer = !$showDrawer;
		$clickOriginatedFromMenu = false;
	}

	/**
	 * If in edit mode, toggle editMode by programmatically clicking `EditModeButton`
	 * to trigger any potential confirm dialogs. Else toggle drawer normally.
	 */
	function handleClick() {
		if ($editMode) {
			$clickOriginatedFromMenu = true;
			const button = document.querySelector('#editmode') as HTMLButtonElement;
			button?.click();
		} else {
			toggleDrawer();
		}
	}

	/**
	 * Handles the keydown events for:
	 * - 'Escape': Hides the search focus/hides the drawer.
	 * - 'Alt': Copy item on drag-and-drop
	 * - 'f': Shows drawer and/or focuses on the search field.
	 */
	function handleKeydown(event: KeyboardEvent) {
		if ($modals.length) return;

		// don't focus on underlying element
		if (event.key === 'Escape' && !$editMode && document.activeElement) {
			(document.activeElement as HTMLElement).blur();
		}

		if (event.key === 'Alt') {
			altKeyPressed = true;
		}

		if (event.key === 'f' && !$disableMenuButton) {
			if (!$showDrawer || !$focusSearch) {
				$focusSearch = true;
				if (!$showDrawer) $showDrawer = true;
				event.preventDefault(); // prevent 'f'
			}
		} else if (event.key === 'Escape' && $showDrawer && !$editMode) {
			$focusSearch = false;
			if (!$drawerSearch) handleClick();
			$drawerSearch = undefined;
		}
	}

	/**
	 * Handle Alt key press and release events for copy-on-drag
	 */
	function handleKeyup(event: KeyboardEvent) {
		if (event.key === 'Alt') {
			altKeyPressed = false;
		}
	}
</script>

<svelte:window
	on:keydown={handleKeydown}
	on:keyup={handleKeyup}
	on:pointerdown={resetInactivityTimer}
/>

<!-- theme -->
<Theme initial={data?.theme} />

<div
	id="layout"
	style:grid-template-columns="{$dashboard?.hide_sidebar || !$dashboard?.sidebar?.length
		? '0'
		: $dashboard?.sidebarWidth || 350}px auto"
	style:grid-template-rows={$showDrawer ? 'auto auto 1fr' : '0fr auto 1fr'}
	style:transition="grid-template-rows {$motion}ms ease, grid-template-columns {$motion}ms ease"
>
	<!-- nav -->
	{#await import('$lib/Main/Views.svelte') then Views}
		<svelte:component this={Views.default} {view} />
	{/await}

	<!-- main -->
	{#if view?.sections}
		{#await import('$lib/Main/Index.svelte') then Main}
			<svelte:component this={Main.default} {view} {altKeyPressed} />
		{/await}
	{:else if $connection}
		{#await import('$lib/Main/Intro.svelte') then Intro}
			<svelte:component this={Intro.default} {data} />
		{/await}
	{/if}

	<!-- aside -->
	{#await import('$lib/Sidebar/Index.svelte') then Sidebar}
		<svelte:component this={Sidebar.default} {altKeyPressed} />
	{/await}

	<!-- menu -->
	{#if !$disableMenuButton}
		{#await import('$lib/Drawer/MenuButton.svelte') then MenuButton}
			<svelte:component this={MenuButton.default} {handleClick} />
		{/await}
	{/if}

	<!-- header -->
	{#if $showDrawer}
		{#await import('$lib/Drawer/Index.svelte') then Drawer}
			<svelte:component this={Drawer.default} {view} {data} {toggleDrawer} />
		{/await}
	{/if}

	<!-- module -->
	{#if $customJs}
		{#await import('$lib/Components/CustomJs.svelte') then CustomJs}
			<svelte:component this={CustomJs.default} />
		{/await}
	{/if}

	{#if $customCss}
		{#await import('$lib/Components/CustomCss.svelte') then CustomCss}
			<svelte:component this={CustomCss.default} />
		{/await}
	{/if}
</div>

<style>
	#layout {
		display: grid;
		grid-template-areas:
			'header header'
			'aside nav'
			'aside main';
		min-height: 100vh;
		min-height: 100dvh;
		overflow: hidden;
	}

	/* Small phones (< 480px) */
	@media (max-width: 479px) {
		#layout {
			grid-template-areas:
				'header header'
				'aside aside'
				'nav nav'
				'main main';
			grid-template-rows: auto auto auto 1fr !important;
		}
	}

	/* Phones and tablets portrait (480px – 768px) */
	@media (min-width: 480px) and (max-width: 768px) {
		#layout {
			grid-template-areas:
				'header header'
				'aside aside'
				'nav nav'
				'main main';
			grid-template-rows: auto auto auto 1fr !important;
		}
	}
</style>
