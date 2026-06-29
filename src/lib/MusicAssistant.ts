import { writable } from 'svelte/store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MAPlayer {
	player_id: string;
	name: string;
	playback_state: 'playing' | 'paused' | 'idle';
	volume_level: number;
	powered: boolean;
	available: boolean;
	group_members: string[];
	can_group_with: string[];
	active_source?: string | null;
}

export interface MAQueue {
	queue_id: string;
	active: boolean;
	available: boolean;
	state: 'playing' | 'paused' | 'idle';
	shuffle_enabled: boolean;
	repeat_mode: 'off' | 'one' | 'all';
	current_index?: number | null;
	current_item?: MAQueueItem | null;
	elapsed_time: number;
	elapsed_time_last_updated: number;
	items: number;
}

export interface MAQueueItem {
	queue_item_id: string;
	name: string;
	duration: number;
	image?: MAMediaItemImage | null;
	uri: string;
	media_type: string;
	artists?: { item_id: string; name: string; uri: string }[];
	album?: { item_id: string; name: string; uri: string } | null;
}

export interface MAMediaItemImage {
	type: string;
	path: string;
	provider: string;
	remotely_accessible: boolean;
	proxy_id?: string | null;
}

export interface MAMediaItem {
	item_id: string;
	uri: string;
	name: string;
	translation_key?: string | null;
	media_type: string;
	// BrowseFolder uses 'path' as browse key; Media items use 'uri'
	path?: string;
	image?: MAMediaItemImage | null;
	artists?: { item_id: string; name: string; uri: string }[];
	album?: { item_id: string; name: string; uri: string } | null;
	is_playable?: boolean;
}

export function imageUrl(
	img: MAMediaItemImage | null | undefined,
	serverUrl: string
): string | null {
	if (!img) return null;
	if (img.remotely_accessible) return img.path;
	if (img.proxy_id) return `${serverUrl.replace(/\/$/, '')}/imageproxy/${img.proxy_id}`;
	return null;
}

// ── Stores ───────────────────────────────────────────────────────────────────

export const maPlayers = writable<MAPlayer[]>([]);
export const maQueues = writable<Record<string, MAQueue>>({});
export const maQueueItems = writable<Record<string, MAQueueItem[]>>({});

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
	token: string;
}

const connections = new Map<string, ConnectionEntry>();
let activeUrl: string | null = null;

function toWsUrl(url: string): string {
	let s = url.trim().replace(/\/$/, '');
	if (!/^https?:\/\//i.test(s) && !/^wss?:\/\//i.test(s)) s = 'http://' + s;
	const u = new URL(s);
	u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
	u.pathname = '/ws';
	return u.toString();
}

function callOn(
	entry: ConnectionEntry,
	command: string,
	data: Record<string, unknown> = {}
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		if (entry.ws.readyState !== WebSocket.OPEN) {
			reject(new Error('WebSocket not open'));
			return;
		}
		const id = ++entry.msgId;
		entry.pending.set(id, { resolve, reject });
		const payload = Object.keys(data).length
			? { message_id: String(id), command, args: data }
			: { message_id: String(id), command };
		entry.ws.send(JSON.stringify(payload));
	});
}

// ── Public API ───────────────────────────────────────────────────────────────

export function connectMA(url: string, token: string): void {
	const existing = connections.get(url);
	if (existing) {
		existing.refCount++;
		return;
	}

	const wsUrl = toWsUrl(url);
	const ws = new WebSocket(wsUrl);
	const entry: ConnectionEntry = { ws, refCount: 1, msgId: 0, pending: new Map(), token };
	connections.set(url, entry);

	ws.onopen = () => {
		callOn(entry, 'auth', { token: entry.token, locale: navigator.language || 'en' })
			.then(() => Promise.all([callOn(entry, 'players/all'), callOn(entry, 'player_queues/all')]))
			.then(([players, queues]) => {
				const playerList = (players as MAPlayer[]) ?? [];
				const queueList = (queues as MAQueue[]) ?? [];
				maPlayers.set(playerList);
				const qmap: Record<string, MAQueue> = {};
				for (const q of queueList) qmap[q.queue_id] = q;
				maQueues.set(qmap);
			})
			.catch((e) => console.error('[MA] init error', e));
	};

	ws.onmessage = ({ data }) => {
		const msg = JSON.parse(data as string) as Record<string, unknown>;

		// command response (message_id may arrive as string or number)
		if (msg.message_id !== undefined) {
			const id = Number(msg.message_id);
			const cb = entry.pending.get(id);
			if (cb) {
				entry.pending.delete(id);
				if (msg.error_code) cb.reject(new Error((msg.details ?? msg.error_code) as string));
				else cb.resolve(msg.result);
			}
			return;
		}

		// live events
		const event = msg.event as string | undefined;
		const evData = msg.data as Record<string, unknown> | undefined;
		if (!event || !evData) return;

		if (event === 'player_added' || event === 'player_updated') {
			const player = evData as unknown as MAPlayer;
			maPlayers.update((list) => {
				const idx = list.findIndex((p) => p.player_id === player.player_id);
				return idx >= 0 ? list.map((p, i) => (i === idx ? player : p)) : [...list, player];
			});
		} else if (event === 'queue_added' || event === 'queue_updated') {
			const queue = evData as unknown as MAQueue;
			maQueues.update((map) => ({ ...map, [queue.queue_id]: queue }));
		} else if (event === 'queue_items_updated') {
			const queue_id =
				(evData as { queue_id?: string }).queue_id ?? (evData as unknown as MAQueue)?.queue_id;
			if (queue_id) {
				callOn(entry, 'player_queues/items', { queue_id, limit: 100, offset: 0 }).then((result) => {
					const items =
						(result as { items?: MAQueueItem[] })?.items ?? (result as MAQueueItem[]) ?? [];
					maQueueItems.update((m) => ({ ...m, [queue_id]: items }));
				});
			}
		}
	};

	ws.onclose = () => {
		connections.delete(url);
		if (activeUrl === url) activeUrl = null;
	};

	activeUrl = url;
}

export function disconnectMA(url: string): void {
	const entry = connections.get(url);
	if (!entry) return;
	entry.refCount--;
	if (entry.refCount <= 0) {
		entry.ws.close();
		connections.delete(url);
		if (activeUrl === url) activeUrl = null;
	}
}

export function callMA(command: string, data: Record<string, unknown> = {}): Promise<unknown> {
	if (!activeUrl) return Promise.reject(new Error('MA not connected'));
	const entry = connections.get(activeUrl);
	if (!entry) return Promise.reject(new Error('MA not connected'));
	return callOn(entry, command, data);
}

export interface MALoginResult {
	token: string;
	username: string;
}

/**
 * Authenticates with username/password and returns a token.
 * auth/login is unauthenticated, so no prior token is needed.
 */
export async function loginMA(
	url: string,
	username: string,
	password: string
): Promise<MALoginResult> {
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
			ws.send(
				JSON.stringify({
					message_id: '1',
					command: 'auth/login',
					args: { username, password, device_name: 'ha-fusion' }
				})
			);
		};
		ws.onmessage = ({ data }) => {
			if (settled) return;
			const msg = JSON.parse(data as string) as Record<string, unknown>;
			if (msg.message_id === undefined) return; // ignore server_info greeting
			if (Number(msg.message_id) !== 1) return;
			settled = true;
			clearTimeout(timer);
			ws.close();
			if (msg.error_code) {
				reject(new Error((msg.details ?? String(msg.error_code)) as string));
				return;
			}
			const result = msg.result as {
				success: boolean;
				access_token?: string;
				error?: string;
				user?: { username: string };
			};
			if (!result?.success || !result.access_token) {
				reject(new Error(result?.error || 'Login failed'));
				return;
			}
			resolve({ token: result.access_token, username: result.user?.username ?? username });
		};
		ws.onerror = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			ws.close();
			reject(new Error('connection_refused'));
		};
		ws.onclose = (e) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(new Error(e.reason || `closed (${e.code})`));
		};
	});
}

/**
 * Opens a one-shot WebSocket connection to validate the URL + token and fetch available players.
 * Does NOT affect the main connection pool.
 */
export async function validateMA(url: string, token: string): Promise<MAPlayer[]> {
	const wsUrl = toWsUrl(url);
	return new Promise((resolve, reject) => {
		let settled = false;
		let authed = false;
		const ws = new WebSocket(wsUrl);
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			ws.close();
			reject(new Error('timeout'));
		}, 5000);

		ws.onopen = () => {
			ws.send(JSON.stringify({ message_id: '1', command: 'auth', args: { token } }));
		};
		ws.onmessage = ({ data }) => {
			if (settled) return;
			const msg = JSON.parse(data as string) as Record<string, unknown>;
			if (msg.message_id === undefined) return; // ignore server_info greeting

			if (!authed && Number(msg.message_id) === 1) {
				if (msg.error_code) {
					settled = true;
					clearTimeout(timer);
					ws.close();
					reject(new Error((msg.details ?? msg.error_code) as string));
					return;
				}
				authed = true;
				ws.send(JSON.stringify({ message_id: '2', command: 'players/all' }));
				return;
			}
			if (authed && Number(msg.message_id) === 2) {
				settled = true;
				clearTimeout(timer);
				ws.close();
				if (msg.error_code) reject(new Error((msg.details ?? msg.error_code) as string));
				else resolve((msg.result as MAPlayer[]) ?? []);
			}
		};
		ws.onerror = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			ws.close();
			reject(new Error('connection_refused'));
		};
		ws.onclose = (e) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(new Error(e.reason || `closed (${e.code})`));
		};
	});
}
