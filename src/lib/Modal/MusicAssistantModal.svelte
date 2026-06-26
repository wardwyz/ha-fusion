<script lang="ts">
	import { lang, ripple } from '$lib/Stores';
	import { onMount, onDestroy } from 'svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { callMA, maPlayers, maQueues, maQueueItems } from '$lib/MusicAssistant';
	import type { MAPlayer, MAQueueItem, MAMediaItem } from '$lib/MusicAssistant';
	import type { MusicAssistantItem } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: MusicAssistantItem;

	type Tab = 'now_playing' | 'queue' | 'browse' | 'search' | 'players';
	const tabs: Tab[] = ['now_playing', 'queue', 'browse', 'search', 'players'];
	let activeTab: Tab = 'now_playing';

	function tabLabel(tab: Tab): string {
		return $lang(tab) || tab;
	}

	// ── Player / queue state ─────────────────────────────────────────────────

	$: player = $maPlayers.find((p) => p.player_id === sel?.player_id) as MAPlayer | undefined;
	$: queue = player ? $maQueues[player.player_id] : undefined;
	$: queueItems = queue ? ($maQueueItems[queue.queue_id] ?? []) : [];
	$: currentItem = queue?.current_item ?? player?.current_item;
	$: isPlaying = player?.state === 'playing';

	// ── Progress bar ─────────────────────────────────────────────────────────

	let progressInterval: ReturnType<typeof setInterval>;
	let displayElapsed = 0;

	$: if (queue) {
		displayElapsed = queue.elapsed_time ?? 0;
	}

	onMount(() => {
		progressInterval = setInterval(() => {
			if (isPlaying) displayElapsed += 1;
		}, 1000);
		loadQueueItems();
	});

	onDestroy(() => {
		clearInterval(progressInterval);
	});

	// reset elapsed when track changes
	$: if (currentItem?.queue_item_id) {
		displayElapsed = queue?.elapsed_time ?? 0;
	}

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	// ── Player commands ──────────────────────────────────────────────────────

	function cmd(command: string, data: Record<string, unknown> = {}) {
		if (!player) return;
		callMA(command, { player_id: player.player_id, ...data });
	}

	function seek(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		cmd('players/cmd/seek', { position: v });
	}

	function setVolume(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		cmd('players/cmd/volume_set', { volume_level: v });
	}

	function cycleRepeat() {
		const modes: Array<'off' | 'one' | 'all'> = ['off', 'one', 'all'];
		const current = player?.repeat_mode ?? 'off';
		const next = modes[(modes.indexOf(current) + 1) % modes.length];
		if (!queue) return;
		callMA('player_queues/repeat', { queue_id: queue.queue_id, repeat_mode: next });
	}

	// ── Queue ────────────────────────────────────────────────────────────────

	async function loadQueueItems() {
		if (!queue) return;
		const result = await callMA('player_queues/items', {
			queue_id: queue.queue_id,
			limit: 100,
			offset: 0
		});
		const items = (result as { items?: MAQueueItem[] })?.items ?? (result as MAQueueItem[]) ?? [];
		maQueueItems.update((m) => ({ ...m, [queue!.queue_id]: items }));
	}

	function clearQueue() {
		if (!queue) return;
		callMA('player_queues/clear', { queue_id: queue.queue_id });
	}

	function removeQueueItem(itemId: string) {
		if (!queue) return;
		callMA('player_queues/delete_item', {
			queue_id: queue.queue_id,
			item_id: itemId
		});
	}

	function playFromIndex(index: number) {
		if (!queue) return;
		callMA('player_queues/play_index', {
			queue_id: queue.queue_id,
			index
		});
	}

	// ── Browse ───────────────────────────────────────────────────────────────

	let browseItems: MAMediaItem[] = [];
	let browsePath: string[] = []; // breadcrumb stack of paths
	let browseLoading = false;

	async function browseDir(path?: string) {
		browseLoading = true;
		try {
			const result = await callMA('music/browse', path ? { path } : {});
			browseItems = (result as MAMediaItem[]) ?? [];
		} finally {
			browseLoading = false;
		}
	}

	async function browseInto(item: MAMediaItem) {
		// Folders may not have browse_path set — fall back to uri
		const path = item.browse_path || (!item.is_playable ? item.uri : null);
		if (!path) return;
		browsePath = [...browsePath, path];
		await browseDir(path);
	}

	async function browseBack() {
		browsePath = browsePath.slice(0, -1);
		await browseDir(browsePath[browsePath.length - 1]);
	}

	async function switchToTab(tab: Tab) {
		activeTab = tab;
		if (tab === 'browse' && browseItems.length === 0) {
			await browseDir();
		}
	}

	// ── Search ───────────────────────────────────────────────────────────────

	let searchQuery = '';
	let searchResults: MAMediaItem[] = [];
	let searchLoading = false;
	let searchDebounce: ReturnType<typeof setTimeout>;

	function onSearchInput() {
		clearTimeout(searchDebounce);
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		searchDebounce = setTimeout(async () => {
			searchLoading = true;
			try {
				const result = await callMA('music/search', {
					search_query: searchQuery,
					limit: 20
				});
				// MA search result may be { tracks, albums, artists, playlists } or flat array
				const r = result as Record<string, MAMediaItem[]> | MAMediaItem[];
				if (Array.isArray(r)) {
					searchResults = r;
				} else {
					searchResults = [
						...(r.tracks ?? []),
						...(r.albums ?? []),
						...(r.artists ?? []),
						...(r.playlists ?? [])
					];
				}
			} finally {
				searchLoading = false;
			}
		}, 300);
	}

	// ── Media actions (browse + search) ─────────────────────────────────────

	let actionMenu: { item: MAMediaItem; x: number; y: number } | null = null;

	function showActionsHandler(item: MAMediaItem): (e: MouseEvent) => void {
		return (e: MouseEvent) => {
			e.stopPropagation();
			actionMenu = { item, x: e.clientX, y: e.clientY };
		};
	}

	function playMedia(item: MAMediaItem, option: 'play' | 'add' | 'next') {
		if (!queue) return;
		callMA('player_queues/play_media', {
			queue_id: queue.queue_id,
			item: { uri: item.uri },
			option
		});
		actionMenu = null;
	}

	// ── Players tab ──────────────────────────────────────────────────────────

	function setPlayerVolume(playerId: string, v: number) {
		callMA('players/cmd/volume_set', {
			player_id: playerId,
			volume_level: v
		});
	}

	function groupPlayer(targetId: string) {
		if (!player) return;
		callMA('players/cmd/group', {
			player_id: player.player_id,
			target_player: targetId
		});
	}

	function ungroupPlayer(targetId: string) {
		callMA('players/cmd/ungroup', { player_id: targetId });
	}

	function onPlayerVolumeChange(playerId: string, e: Event) {
		setPlayerVolume(playerId, parseFloat((e.target as HTMLInputElement).value));
	}
</script>

<svelte:window on:click={() => (actionMenu = null)} />

{#if isOpen}
	<Modal size="large">
		<h1 slot="title">{sel?.name || $lang('music_assistant') || 'Music Assistant'}</h1>

		<!-- Tab bar -->
		<div class="tabs">
			{#each tabs as tab}
				<button
					class="tab"
					class:active={activeTab === tab}
					on:click={() => switchToTab(tab)}
					use:Ripple={$ripple}
				>
					{tabLabel(tab)}
				</button>
			{/each}
		</div>

		<!-- ── Now Playing ──────────────────────────────────────────────────── -->
		{#if activeTab === 'now_playing'}
			<div class="now-playing">
				{#if currentItem}
					{#if currentItem.image}
						<img class="art" src={currentItem.image} alt={currentItem.name} />
					{:else}
						<div class="art-placeholder">
							<Icon icon="solar:music-note-2-bold-duotone" height="none" />
						</div>
					{/if}
					<div class="track-info">
						<span class="track-title">{currentItem.name}</span>
						<span class="track-artist">{currentItem.artists?.[0]?.name ?? ''}</span>
						<span class="track-album">{currentItem.album?.name ?? ''}</span>
					</div>
				{:else}
					<div class="art-placeholder">
						<Icon icon="solar:music-note-2-bold-duotone" height="none" />
					</div>
					<div class="track-info">
						<span class="track-title">{player?.state ?? '—'}</span>
					</div>
				{/if}

				<!-- progress bar -->
				{#if currentItem?.duration}
					<div class="progress-row">
						<span class="time">{formatTime(displayElapsed)}</span>
						<input
							type="range"
							class="progress"
							min="0"
							max={currentItem.duration}
							value={displayElapsed}
							on:change={seek}
						/>
						<span class="time">{formatTime(currentItem.duration)}</span>
					</div>
				{/if}

				<!-- controls -->
				<div class="controls">
					<button class="ctrl" on:click={() => cmd('players/cmd/previous')} use:Ripple={$ripple}>
						<Icon icon="solar:skip-previous-bold" height="none" />
					</button>
					<button class="ctrl play" on:click={() => cmd(isPlaying ? 'players/cmd/pause' : 'players/cmd/play')} use:Ripple={$ripple}>
						<Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} height="none" />
					</button>
					<button class="ctrl" on:click={() => cmd('players/cmd/next')} use:Ripple={$ripple}>
						<Icon icon="solar:skip-next-bold" height="none" />
					</button>
					<button class="ctrl" on:click={() => cmd('players/cmd/stop')} use:Ripple={$ripple}>
						<Icon icon="solar:stop-bold" height="none" />
					</button>
				</div>

				<!-- volume -->
				<div class="volume-row">
					<Icon icon="solar:volume-small-bold" height="none" />
					<input
						type="range"
						class="volume"
						min="0"
						max="100"
						value={player?.volume_level ?? 50}
						on:change={setVolume}
					/>
					<span class="vol-label">{Math.round(player?.volume_level ?? 0)}</span>
				</div>

				<!-- shuffle + repeat -->
				<div class="toggles">
					<button
						class="toggle"
						class:active={player?.shuffle}
						on:click={() => { if (queue) callMA('player_queues/shuffle', { queue_id: queue.queue_id, shuffle_enabled: !player?.shuffle }); }}
						use:Ripple={$ripple}
					>
						<Icon icon="solar:shuffle-bold" height="none" />
						{$lang('shuffle') || 'Shuffle'}
					</button>
					<button class="toggle" class:active={(player?.repeat_mode ?? 'off') !== 'off'} on:click={cycleRepeat} use:Ripple={$ripple}>
						<Icon icon={player?.repeat_mode === 'one' ? 'solar:repeat-one-bold' : 'solar:repeat-bold'} height="none" />
						{$lang('repeat') || 'Repeat'}{player?.repeat_mode !== 'off' ? ` (${player?.repeat_mode})` : ''}
					</button>
				</div>
			</div>

		<!-- ── Queue ─────────────────────────────────────────────────────────── -->
		{:else if activeTab === 'queue'}
			<div class="tab-header">
				<span class="tab-count">{queueItems.length} {$lang('queue') || 'queue'}</span>
				{#if queueItems.length > 0}
					<button class="action-sm" on:click={clearQueue} use:Ripple={$ripple}>
						{$lang('clear_queue') || 'Clear queue'}
					</button>
				{/if}
			</div>
			<div class="queue-list">
				{#each queueItems as item, i (item.queue_item_id)}
					<div
						class="queue-item"
						class:current={item.queue_item_id === currentItem?.queue_item_id}
					>
						{#if item.image}
							<img class="q-art" src={item.image} alt={item.name} />
						{:else}
							<div class="q-art-placeholder">
								<Icon icon="solar:music-note-2-bold-duotone" height="none" />
							</div>
						{/if}
						<div class="q-info">
							<span class="q-title">{item.name}</span>
							<span class="q-artist">{item.artists?.[0]?.name ?? ''}</span>
						</div>
						<span class="q-dur">{formatTime(item.duration ?? 0)}</span>
						<div class="q-actions">
							<button class="icon-btn" title="Play" on:click={() => playFromIndex(i)} use:Ripple={$ripple}>
								<Icon icon="solar:play-bold" height="none" />
							</button>
							<button class="icon-btn" title="Remove" on:click={() => removeQueueItem(item.queue_item_id)} use:Ripple={$ripple}>
								<Icon icon="mdi:close" height="none" />
							</button>
						</div>
					</div>
				{:else}
					<p class="empty">{$lang('queue') || 'Queue'} —</p>
				{/each}
			</div>

		<!-- ── Browse ────────────────────────────────────────────────────────── -->
		{:else if activeTab === 'browse'}
			{#if browsePath.length > 0}
				<button class="back-btn" on:click={browseBack} use:Ripple={$ripple}>
					<Icon icon="solar:arrow-left-bold" height="none" />
					{browsePath[browsePath.length - 1]}
				</button>
			{/if}
			{#if browseLoading}
				<div class="loading"><Icon icon="svg-spinners:ring-resize" height="none" /></div>
			{:else}
				<div class="media-list">
					{#each browseItems as item (item.uri)}
						<div class="media-item">
							{#if item.image}
								<img class="m-art" src={item.image} alt={item.name} />
							{:else}
								<div class="m-art-placeholder">
									<Icon icon="solar:music-note-2-bold-duotone" height="none" />
								</div>
							{/if}
							<div class="m-info" on:click={() => browseInto(item)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && browseInto(item)}>
								<span class="m-title">{item.name}</span>
								<span class="m-type">{item.media_type}</span>
							</div>
							{#if item.is_playable}
								<button class="icon-btn" on:click={showActionsHandler(item)} use:Ripple={$ripple}>
									<Icon icon="solar:menu-dots-bold" height="none" />
								</button>
							{/if}
						</div>
					{:else}
						<p class="empty">—</p>
					{/each}
				</div>
			{/if}

		<!-- ── Search ─────────────────────────────────────────────────────────── -->
		{:else if activeTab === 'search'}
			<input
				class="input search-input"
				type="search"
				placeholder={$lang('search') || 'Search'}
				bind:value={searchQuery}
				on:input={onSearchInput}
				autocomplete="off"
				spellcheck="false"
			/>
			{#if searchLoading}
				<div class="loading"><Icon icon="svg-spinners:ring-resize" height="none" /></div>
			{:else}
				<div class="media-list">
					{#each searchResults as item (item.uri)}
						<div class="media-item">
							{#if item.image}
								<img class="m-art" src={item.image} alt={item.name} />
							{:else}
								<div class="m-art-placeholder">
									<Icon icon="solar:music-note-2-bold-duotone" height="none" />
								</div>
							{/if}
							<div class="m-info">
								<span class="m-title">{item.name}</span>
								<span class="m-type">{item.media_type}</span>
							</div>
							{#if item.is_playable}
								<button class="icon-btn" on:click={showActionsHandler(item)} use:Ripple={$ripple}>
									<Icon icon="solar:menu-dots-bold" height="none" />
								</button>
							{/if}
						</div>
					{:else}
						{#if searchQuery}
							<p class="empty">—</p>
						{/if}
					{/each}
				</div>
			{/if}

		<!-- ── Players ───────────────────────────────────────────────────────── -->
		{:else if activeTab === 'players'}
			<div class="player-list-tab">
				{#each $maPlayers as p (p.player_id)}
					<div class="player-row">
						<div class="p-info">
							<span class="p-name">{p.name}</span>
							<span class="p-state">{p.state}</span>
						</div>
						<div class="p-volume">
							<Icon icon="solar:volume-small-bold" height="none" />
							<input
								type="range"
								min="0"
								max="100"
								value={p.volume_level}
								on:change={(e) => onPlayerVolumeChange(p.player_id, e)}
							/>
						</div>
						{#if p.player_id !== sel?.player_id && player?.can_group_with?.includes(p.player_id)}
							{#if player?.group_childs?.includes(p.player_id)}
								<button class="action-sm" on:click={() => ungroupPlayer(p.player_id)} use:Ripple={$ripple}>
									{$lang('ungroup') || 'Ungroup'}
								</button>
							{:else}
								<button class="action-sm" on:click={() => groupPlayer(p.player_id)} use:Ripple={$ripple}>
									{$lang('group') || 'Group'}
								</button>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Modal>
{/if}

<!-- Context menu for browse/search actions -->
{#if actionMenu}
	{@const menu = actionMenu}
	<div
		class="action-menu"
		style:left="{menu.x}px"
		style:top="{menu.y}px"
		role="menu"
	>
		<button on:click={() => playMedia(menu.item, 'play')} use:Ripple={$ripple}>
			<Icon icon="solar:play-bold" height="none" />
			{$lang('play_now') || 'Play now'}
		</button>
		<button on:click={() => playMedia(menu.item, 'next')} use:Ripple={$ripple}>
			<Icon icon="solar:skip-next-bold" height="none" />
			{$lang('play_next') || 'Play next'}
		</button>
		<button on:click={() => playMedia(menu.item, 'add')} use:Ripple={$ripple}>
			<Icon icon="solar:add-circle-bold" height="none" />
			{$lang('add_to_queue') || 'Add to queue'}
		</button>
	</div>
{/if}

<style>
	/* ── Tab bar ─────────────────────────────────────────────────── */
	.tabs {
		display: flex;
		gap: 0.2rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 0.2rem;
		flex-wrap: wrap;
	}

	.tab {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
		border-radius: 0.4rem;
		transition: color 120ms, background-color 120ms;
	}

	.tab:hover {
		color: rgba(255, 255, 255, 0.8);
		background: rgba(255, 255, 255, 0.06);
	}

	.tab.active {
		color: white;
		background: rgba(255, 255, 255, 0.12);
	}

	/* ── Now Playing ─────────────────────────────────────────────── */
	.now-playing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.art {
		width: 12rem;
		height: 12rem;
		object-fit: cover;
		border-radius: 0.6rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
	}

	.art-placeholder {
		width: 12rem;
		height: 12rem;
		border-radius: 0.6rem;
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 4rem;
		opacity: 0.3;
	}

	.track-info {
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.track-title {
		font-size: 1.1rem;
		font-weight: 600;
	}

	.track-artist {
		font-size: 0.9rem;
		opacity: 0.7;
	}

	.track-album {
		font-size: 0.8rem;
		opacity: 0.5;
	}

	.progress-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		max-width: 28rem;
	}

	.progress {
		flex: 1;
		accent-color: white;
	}

	.time {
		font-size: 0.75rem;
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
		min-width: 2.5rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ctrl {
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 50%;
		width: 2.8rem;
		height: 2.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: inherit;
		font-size: 1.1rem;
		transition: background-color 120ms;
	}

	.ctrl:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.ctrl.play {
		width: 3.4rem;
		height: 3.4rem;
		font-size: 1.4rem;
		background: rgba(255, 255, 255, 0.15);
	}

	.ctrl.play:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.volume-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		max-width: 28rem;
		font-size: 1rem;
	}

	.volume-row :global(svg) {
		width: 1.2rem;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.volume {
		flex: 1;
		accent-color: white;
	}

	.vol-label {
		font-size: 0.75rem;
		opacity: 0.6;
		min-width: 2rem;
		text-align: right;
	}

	.toggles {
		display: flex;
		gap: 0.5rem;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.8rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2rem;
		color: rgba(255, 255, 255, 0.5);
		font-family: inherit;
		font-size: 0.78rem;
		cursor: pointer;
		transition: all 120ms;
	}

	.toggle :global(svg) {
		width: 1rem;
	}

	.toggle.active {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
		color: white;
	}

	/* ── Queue ───────────────────────────────────────────────────── */
	.tab-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.6rem;
	}

	.tab-count {
		font-size: 0.8rem;
		opacity: 0.6;
	}

	.queue-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		overflow-y: auto;
		max-height: 24rem;
	}

	.queue-item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0.5rem;
		border-radius: 0.4rem;
		transition: background-color 120ms;
	}

	.queue-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.queue-item.current {
		background: rgba(255, 255, 255, 0.1);
	}

	.q-art {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: cover;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.q-art-placeholder {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 0.9rem;
		opacity: 0.4;
	}

	.q-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.q-title {
		font-size: 0.85rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.q-artist {
		font-size: 0.75rem;
		opacity: 0.6;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.q-dur {
		font-size: 0.75rem;
		opacity: 0.5;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.q-actions {
		display: flex;
		gap: 0.2rem;
	}

	/* ── Browse / Search shared ──────────────────────────────────── */
	.back-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		color: inherit;
		font-family: inherit;
		font-size: 0.85rem;
		opacity: 0.7;
		cursor: pointer;
		padding: 0.3rem 0.4rem;
		border-radius: 0.4rem;
		margin-bottom: 0.6rem;
	}

	.back-btn :global(svg) {
		width: 1rem;
	}

	.media-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		overflow-y: auto;
		max-height: 24rem;
	}

	.media-item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0.5rem;
		border-radius: 0.4rem;
		transition: background-color 120ms;
	}

	.media-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.m-art {
		width: 2.5rem;
		height: 2.5rem;
		object-fit: cover;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.m-art-placeholder {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.25rem;
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 0.9rem;
		opacity: 0.4;
	}

	.m-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		cursor: pointer;
	}

	.m-title {
		font-size: 0.85rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.m-type {
		font-size: 0.72rem;
		opacity: 0.5;
		text-transform: capitalize;
	}

	.search-input {
		margin-bottom: 0.8rem;
		width: 100%;
	}

	/* ── Players tab ─────────────────────────────────────────────── */
	.player-list-tab {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.player-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.6rem 0.8rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.5rem;
	}

	.p-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.p-name {
		font-size: 0.85rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.p-state {
		font-size: 0.72rem;
		opacity: 0.5;
	}

	.p-volume {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.p-volume :global(svg) {
		width: 1rem;
		opacity: 0.6;
	}

	/* ── Shared helpers ──────────────────────────────────────────── */
	.icon-btn {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.3rem;
		border-radius: 0.3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.5;
		transition: opacity 120ms;
		font-size: 0.9rem;
	}

	.icon-btn:hover {
		opacity: 1;
	}

	.icon-btn :global(svg) {
		width: 1rem;
	}

	.action-sm {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.4rem;
		color: inherit;
		font-family: inherit;
		font-size: 0.75rem;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 120ms;
	}

	.action-sm:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.loading {
		display: flex;
		justify-content: center;
		padding: 2rem;
		font-size: 1.5rem;
		opacity: 0.5;
	}

	.empty {
		text-align: center;
		opacity: 0.4;
		font-size: 0.85rem;
		padding: 2rem 0;
	}

	/* ── Context action menu ─────────────────────────────────────── */
	.action-menu {
		position: fixed;
		z-index: 9999;
		background: var(--theme-modal-background-color-modal, #1e1e2e);
		backdrop-filter: blur(1rem);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.6rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		padding: 0.3rem;
		display: flex;
		flex-direction: column;
		min-width: 11rem;
	}

	.action-menu button {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.8rem;
		background: none;
		border: none;
		color: inherit;
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		border-radius: 0.35rem;
		text-align: left;
		transition: background-color 120ms;
	}

	.action-menu button:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.action-menu button :global(svg) {
		width: 1rem;
		flex-shrink: 0;
	}
</style>
