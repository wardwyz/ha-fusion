import { writable } from 'svelte/store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MAPlayer {
	player_id: string;
	name: string;
	state: 'playing' | 'paused' | 'stopped' | 'idle';
	volume_level: number;
	shuffle: boolean;
	repeat_mode: 'off' | 'one' | 'all';
	current_item?: MAQueueItem | null;
	elapsed_time: number;
	elapsed_time_last_updated?: string;
	group_childs: string[];
	can_group_with: string[];
	powered: boolean;
	available: boolean;
}

export interface MAQueue {
	queue_id: string;
	active: boolean;
	shuffle_enabled: boolean;
	repeat_mode: 'off' | 'one' | 'all';
	stream_title?: string;
	current_index?: number;
	current_item?: MAQueueItem | null;
	elapsed_time: number;
	elapsed_time_last_updated: string;
}

export interface MAQueueItem {
	queue_item_id: string;
	name: string;
	duration: number;
	image?: string | null;
	uri: string;
	media_type: string;
	artists?: { item_id: string; name: string; uri: string }[];
	album?: { item_id: string; name: string; uri: string } | null;
}

export interface MAMediaItem {
	item_id: string;
	uri: string;
	name: string;
	media_type: string;
	image?: string | null;
	artists?: { item_id: string; name: string; uri: string }[];
	album?: { item_id: string; name: string; uri: string } | null;
	is_playable?: boolean;
	browse_path?: string;
	folder_name?: string;
}

// ── Stores ───────────────────────────────────────────────────────────────────

export const maPlayers = writable<MAPlayer[]>([]);
export const maQueues = writable<Record<string, MAQueue>>({});
export const maQueueItems = writable<Record<string, MAQueueItem[]>>({});
export const maConnected = writable<boolean>(false);

// ── Internal connection map ──────────────────────────────────────────────────

interface PendingCall {
	resolve: (result: unknown) => void;
	reject: (error: Error) => void;
}

interface ConnectionEntry {
	ws: WebSocket;
	refCount: number;
	msgId: number;
	pending: Map<number, PendingCall>;
}

const connections = new Map<string, ConnectionEntry>();

function toWsUrl(url: string): string {
	const u = new URL(url.endsWith('/') ? url.slice(0, -1) : url);
	u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
	u.pathname = '/ws';
	return u.toString();
}

function callOn(entry: ConnectionEntry, command: string, data: Record<string, unknown> = {}): Promise<unknown> {
	return new Promise((resolve, reject) => {
		if (entry.ws.readyState !== WebSocket.OPEN) {
			reject(new Error('WebSocket not open'));
			return;
		}
		const id = ++entry.msgId;
		entry.pending.set(id, { resolve, reject });
		entry.ws.send(JSON.stringify({ message_id: id, command, ...data }));
	});
}

// ── Public API ───────────────────────────────────────────────────────────────

export function connectMA(url: string): void {
	const existing = connections.get(url);
	if (existing) {
		existing.refCount++;
		return;
	}

	const wsUrl = toWsUrl(url);
	const ws = new WebSocket(wsUrl);
	const entry: ConnectionEntry = { ws, refCount: 1, msgId: 0, pending: new Map() };
	connections.set(url, entry);

	ws.onopen = () => {
		maConnected.set(true);
		Promise.all([
			callOn(entry, 'players/get_players'),
			callOn(entry, 'player_queues/get_player_queues')
		]).then(([players, queues]) => {
			maPlayers.set((players as MAPlayer[]) ?? []);
			const qmap: Record<string, MAQueue> = {};
			for (const q of ((queues as MAQueue[]) ?? [])) qmap[q.queue_id] = q;
			maQueues.set(qmap);
		});
	};

	ws.onmessage = ({ data }) => {
		const msg = JSON.parse(data as string) as Record<string, unknown>;

		// command response
		if (msg.message_id !== undefined) {
			const cb = entry.pending.get(msg.message_id as number);
			if (cb) {
				entry.pending.delete(msg.message_id as number);
				if (msg.error_code) cb.reject(new Error((msg.details ?? msg.error_code) as string));
				else cb.resolve(msg.result);
			}
			return;
		}

		// live events
		const event = msg.event as string | undefined;
		const evData = msg.data as Record<string, unknown> | undefined;
		if (!event || !evData) return;

		if (event === 'players/updated') {
			const player = evData as unknown as MAPlayer;
			maPlayers.update((list) => {
				const idx = list.findIndex((p) => p.player_id === player.player_id);
				return idx >= 0 ? list.map((p, i) => (i === idx ? player : p)) : [...list, player];
			});
		} else if (event === 'player_queues/updated') {
			const queue = evData as unknown as MAQueue;
			maQueues.update((map) => ({ ...map, [queue.queue_id]: queue }));
		} else if (event === 'queue_items/updated') {
			const queue_id = (evData as { queue_id?: string }).queue_id;
			if (queue_id) {
				callOn(entry, 'player_queues/queue_items', { queue_id, limit: 100, offset: 0 }).then(
					(result) => {
						const items = (result as { items?: MAQueueItem[] })?.items ?? (result as MAQueueItem[]) ?? [];
						maQueueItems.update((m) => ({ ...m, [queue_id]: items }));
					}
				);
			}
		}
	};

	ws.onclose = () => {
		connections.delete(url);
		maConnected.set(false);
	};
}

export function disconnectMA(url: string): void {
	const entry = connections.get(url);
	if (!entry) return;
	entry.refCount--;
	if (entry.refCount <= 0) {
		entry.ws.close();
		connections.delete(url);
	}
}

export function callMA(url: string, command: string, data: Record<string, unknown> = {}): Promise<unknown> {
	const entry = connections.get(url);
	if (!entry) return Promise.reject(new Error('Not connected to ' + url));
	return callOn(entry, command, data);
}

/**
 * Opens a one-shot WebSocket connection to validate the URL and fetch available players.
 * Does NOT affect the main connection pool.
 */
export async function validateMA(url: string): Promise<MAPlayer[]> {
	const wsUrl = toWsUrl(url);
	return new Promise((resolve, reject) => {
		let settled = false;
		const ws = new WebSocket(wsUrl);
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			ws.close();
			reject(new Error('timeout'));
		}, 5000);

		ws.onopen = () => {
			ws.send(JSON.stringify({ message_id: 1, command: 'players/get_players' }));
		};
		ws.onmessage = ({ data }) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			const msg = JSON.parse(data as string) as Record<string, unknown>;
			ws.close();
			if (msg.error_code) reject(new Error((msg.details ?? msg.error_code) as string));
			else resolve((msg.result as MAPlayer[]) ?? []);
		};
		ws.onerror = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			ws.close();
			reject(new Error('connection_refused'));
		};
	});
}
