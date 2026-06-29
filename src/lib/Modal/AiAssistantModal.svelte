<script lang="ts">
	import {
		connection,
		states,
		dashboard,
		configuration,
		aiConversation,
		lang,
		motion
	} from '$lib/Stores';
	import Modal from '$lib/Modal/Index.svelte';
	import Icon from '@iconify/svelte';
	import { getAllEntityIds, toSpeechLang } from '$lib/Utils';
	import { afterUpdate, onMount } from 'svelte';
	import type { AiMessage } from '$lib/Types';
	import { maPlayers, maQueues, callMA } from '$lib/MusicAssistant';

	export let isOpen: boolean;
	export let sel: any;
	export let autoListen = false;

	$: if (!isOpen) {
		recognition?.stop();
		window.speechSynthesis?.cancel();
		micState = 'idle';
	}

	type MicState = 'idle' | 'listening' | 'processing';

	let micState: MicState = 'idle';
	let inputText = '';
	let messagesEl: HTMLDivElement;
	let recognition: any = null;
	let holdTimer: ReturnType<typeof setTimeout>;
	let isPushToTalk = false;

	const SpeechRecognition =
		typeof window !== 'undefined'
			? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
			: null;

	const hasSpeech = !!SpeechRecognition;

	$: botIcon = sel?.icon || 'fluent:bot-24-filled';

	let voices: SpeechSynthesisVoice[] = [];

	function loadVoices() {
		voices = window.speechSynthesis.getVoices();
	}

	if (typeof window !== 'undefined' && window.speechSynthesis) {
		loadVoices();
		window.speechSynthesis.onvoiceschanged = loadVoices;
	}

	function getBestVoice(lang: string): SpeechSynthesisVoice | null {
		if (!voices.length) return null;
		const exact = lang.toLowerCase();
		const prefix = exact.split('-')[0];
		const candidates =
			voices.filter((v) => v.lang.toLowerCase() === exact).length > 0
				? voices.filter((v) => v.lang.toLowerCase() === exact)
				: voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
		if (!candidates.length) return null;
		// Prefer neural/natural/enhanced voices (much higher quality)
		return candidates.find((v) => /natural|neural|enhanced/i.test(v.name)) ?? candidates[0];
	}

	function getVoiceByName(name: string): SpeechSynthesisVoice | undefined {
		return voices.find((v) => v.name === name);
	}

	afterUpdate(() => {
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	});

	onMount(() => {
		if (autoListen && hasSpeech) {
			// Wait for modal animation before grabbing the mic
			setTimeout(() => startListening(), ($motion || 300) * 2);
		}
	});

	function buildContext(): string {
		const entityIds = getAllEntityIds($dashboard);
		const lines = entityIds
			.filter((id) => $states?.[id])
			.map((id) => {
				const s = $states[id];
				const name = s.attributes?.friendly_name || id;
				const unit = s.attributes?.unit_of_measurement
					? ` ${s.attributes.unit_of_measurement}`
					: '';
				return `- ${name} (${id}): ${s.state}${unit}`;
			});

		return `[SYSTEM — Nova Domus dashboard assistant]
You are an assistant for a specific smart home dashboard. You MUST follow these rules without exception:
1. ONLY answer questions about the entities listed below. These are the ONLY entities that exist in this dashboard.
2. If the user asks about any device, sensor or entity NOT present in the list, reply that it is not configured in this dashboard.
3. Do NOT use any general Home Assistant knowledge to reference, suggest or invent entities outside this list.
4. You may help control or query devices, but ONLY using the entities listed here.
5. Reply in the same language the user writes in.

Configured dashboard entities:
${lines.join('\n')}${buildMAContext()}
[END SYSTEM]`;
	}

	function buildMAContext(): string {
		if (!$maPlayers.length) return '';

		const playerLines = $maPlayers
			.filter((p) => p.available)
			.map((p) => {
				const state = $maQueues[p.player_id]?.state ?? p.playback_state;
				return `- "${p.name}" (id: ${p.player_id}): ${state}, volume ${Math.round(p.volume_level)}%`;
			})
			.join('\n');

		if (!playerLines) return '';

		const playingQueue = Object.values($maQueues).find((q) => q.state === 'playing');
		const playingPlayer = playingQueue
			? $maPlayers.find((p) => p.player_id === playingQueue.queue_id)
			: null;

		let nowPlaying = '';
		if (playingQueue?.current_item && playingPlayer) {
			const item = playingQueue.current_item;
			const artist = item.artists?.[0]?.name ?? '';
			const album = item.album?.name ?? '';
			nowPlaying = `\nCurrently playing on "${playingPlayer.name}": "${item.name}"${artist ? ` by ${artist}` : ''}${album ? ` — ${album}` : ''}\nShuffle: ${playingQueue.shuffle_enabled ? 'on' : 'off'} | Repeat: ${playingQueue.repeat_mode}`;
		}

		return `

[MA_SYSTEM]
Music Assistant is connected. You can control music players directly.

Available players:
${playerLines}${nowPlaying}
Rules:
1. When the user asks for music control, embed one or more command blocks:
   [MA_CMD]{"command":"...","args":{...}}[/MA_CMD]
2. If no player is specified, list the available players and ask the user to choose before executing.
3. Prefer MA commands for players listed above. Use HA services only for players NOT in this list.
4. The app executes [MA_CMD] blocks silently — do NOT mention them in your reply text.

Available commands:
  player_queues/play         args: { queue_id }
  player_queues/pause        args: { queue_id }
  player_queues/stop         args: { queue_id }
  player_queues/next         args: { queue_id }
  player_queues/previous     args: { queue_id }
  players/cmd/volume_set     args: { player_id, volume_level: 0-100 }
  player_queues/shuffle      args: { queue_id, shuffle_enabled: true|false }
  player_queues/repeat       args: { queue_id, repeat_mode: "off"|"one"|"all" }
  player_queues/clear        args: { queue_id }
  player_queues/play_media   args: { queue_id, media: <uri>, option: "replace"|"add"|"next" }
  music/search_and_play      args: { queue_id, search_query, option: "replace"|"add"|"next" }
                             (client macro: searches tracks then plays first playable result)
                             NOTE: for radio stations use the full station name (e.g. "Radio Deejay",
                             "Radio Capital") — generic "radio" returns 0 results.
[/MA_SYSTEM]`;
	}

	function extractMACommands(
		text: string
	): Array<{ command: string; args: Record<string, unknown> }> {
		const matches = [...text.matchAll(/\[MA_CMD\]([\s\S]*?)\[\/MA_CMD\]/g)];
		return matches.flatMap((m) => {
			try {
				const parsed = JSON.parse(m[1].trim()) as {
					command: string;
					args?: Record<string, unknown>;
				};
				return [{ command: parsed.command, args: parsed.args ?? {} }];
			} catch {
				return [];
			}
		});
	}

	function stripMACommands(text: string): string {
		return (
			text
				.replace(/```[a-z]*\s*\n?\[MA_CMD\][\s\S]*?\[\/MA_CMD\]\n?```\n?/g, '')
				.replace(/`\[MA_CMD\][\s\S]*?\[\/MA_CMD\]`/g, '')
				.replace(/\[MA_CMD\][\s\S]*?\[\/MA_CMD\]/g, '')
				.trim()
		);
	}

	async function handleSearchAndPlay(args: Record<string, unknown>): Promise<void> {
		if (!args.queue_id) {
			console.warn('[AI→MA] search_and_play: no queue_id provided');
			return;
		}
		if (!args.search_query) return;
		const result = await callMA('music/search', {
			search_query: args.search_query as string,
			limit: 5
		});
		const raw: Array<{ uri: string; is_playable?: boolean }> = Array.isArray(result)
			? (result as Array<{ uri: string; is_playable?: boolean }>)
			: (((result as Record<string, unknown>)?.tracks as Array<{
					uri: string;
					is_playable?: boolean;
			  }>) ?? []);
		const arr = raw.filter((item) => item.is_playable !== false);
		if (!arr.length) return;
		await callMA('player_queues/play_media', {
			queue_id: args.queue_id as string,
			media: arr[0].uri,
			option: (args.option as string) ?? 'replace'
		});
	}

	function detectMAIntent(text: string): { command: string; args: Record<string, unknown> } | null {
		const t = text.toLowerCase();

		const target =
			$maPlayers.find((p) => ($maQueues[p.player_id]?.state ?? p.playback_state) === 'playing') ??
			$maPlayers.find((p) => p.available);
		if (!target) return null;

		const qid = target.player_id;
		const pid = target.player_id;

		if (/\b(pausa|pause)\b/.test(t))
			return { command: 'player_queues/pause', args: { queue_id: qid } };
		if (/\b(stop|ferma)\b/.test(t))
			return { command: 'player_queues/stop', args: { queue_id: qid } };
		if (/\b(play|riproduci|avvia)\b/.test(t))
			return { command: 'player_queues/play', args: { queue_id: qid } };
		if (/\b(prossim|next|avanti)\b/.test(t))
			return { command: 'player_queues/next', args: { queue_id: qid } };
		if (/\b(precedent|previous|indietro)\b/.test(t))
			return { command: 'player_queues/previous', args: { queue_id: qid } };

		const volExact = t.match(/volume\s+(\d+)/);
		if (volExact)
			return {
				command: 'players/cmd/volume_set',
				args: { player_id: pid, volume_level: parseInt(volExact[1], 10) }
			};

		if (/alza.*volume|volume.*su/.test(t))
			return {
				command: 'players/cmd/volume_set',
				args: { player_id: pid, volume_level: Math.min(100, (target.volume_level ?? 50) + 10) }
			};
		if (/abbassa.*volume|volume.*gi/.test(t))
			return {
				command: 'players/cmd/volume_set',
				args: { player_id: pid, volume_level: Math.max(0, (target.volume_level ?? 50) - 10) }
			};

		const shuffleMatch = t.match(/shuffle\s+(on|off)/);
		if (shuffleMatch)
			return {
				command: 'player_queues/shuffle',
				args: { queue_id: qid, shuffle_enabled: shuffleMatch[1] === 'on' }
			};

		if (/svuota.*coda|clear.*queue/.test(t))
			return { command: 'player_queues/clear', args: { queue_id: qid } };

		return null;
	}

	async function sendMessage(text: string) {
		if (!text.trim() || micState === 'processing') return;

		const userMsg: AiMessage = { role: 'user', content: text.trim(), timestamp: Date.now() };
		$aiConversation = {
			...$aiConversation,
			messages: [...$aiConversation.messages, userMsg]
		};
		inputText = '';
		micState = 'processing';

		try {
			const payload = `${buildContext()}\n\n${text.trim()}`;

			console.debug('[AI Assistant] payload →', payload);

			const response: any = await $connection.sendMessagePromise({
				type: 'conversation/process',
				text: payload,
				conversation_id: $aiConversation.conversationId ?? undefined,
				language: $configuration?.locale || 'en',
				...(sel?.agent_id ? { agent_id: sel.agent_id } : {})
			});

			const rawText = response?.response?.speech?.plain?.speech ?? '…';
			console.debug('[AI→MA] rawText:', rawText.slice(0, 300));
			const maCommands = extractMACommands(rawText);
			const displayText = stripMACommands(rawText);
			console.debug('[AI→MA] displayText:', displayText, '| commands:', maCommands.length);

			const newConversationId = response?.conversation_id ?? $aiConversation.conversationId;
			if (displayText) {
				$aiConversation = {
					messages: [
						...$aiConversation.messages,
						{ role: 'assistant', content: displayText, timestamp: Date.now() }
					],
					conversationId: newConversationId
				};
				speak(displayText);
			} else {
				$aiConversation = { ...$aiConversation, conversationId: newConversationId };
			}

			if (maCommands.length > 0) {
				for (const { command, args } of maCommands) {
					try {
						if (command === 'music/search_and_play') {
							await handleSearchAndPlay(args);
						} else {
							await callMA(command, args);
						}
					} catch (e) {
						console.error('[AI→MA] command failed:', command, e);
					}
				}
			} else {
				const fallback = detectMAIntent(text.trim());
				if (fallback) {
					try {
						await callMA(fallback.command, fallback.args);
					} catch (e) {
						console.error('[AI→MA] fallback failed:', fallback.command, e);
					}
				}
			}
		} catch (err) {
			$aiConversation = {
				...$aiConversation,
				messages: [
					...$aiConversation.messages,
					{ role: 'assistant', content: $lang('ai_error'), timestamp: Date.now() }
				]
			};
		} finally {
			micState = 'idle';
		}
	}

	function speak(text: string) {
		if (!text || !window.speechSynthesis) return;
		if (sel?.tts_enabled === false) return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		const speechLang = toSpeechLang($configuration?.locale);
		utterance.lang = speechLang;
		const voice = sel?.tts_voice
			? (getVoiceByName(sel.tts_voice) ?? getBestVoice(speechLang))
			: getBestVoice(speechLang);
		if (voice) utterance.voice = voice;
		console.debug(
			'[AI Assistant] TTS voice →',
			voice?.name ?? 'browser default',
			`(${speechLang})`
		);
		window.speechSynthesis.speak(utterance);
	}

	function startListening() {
		if (!hasSpeech || micState === 'processing') return;
		recognition = new SpeechRecognition();
		recognition.lang = toSpeechLang($configuration?.locale);
		recognition.continuous = false;
		recognition.interimResults = false;
		micState = 'listening';

		recognition.onresult = (event: any) => {
			const transcript = event.results[0][0].transcript;
			sendMessage(transcript);
		};
		recognition.onerror = () => {
			micState = 'idle';
		};
		recognition.onend = () => {
			if (micState === 'listening') micState = 'idle';
		};
		recognition.start();
	}

	function stopListening() {
		recognition?.stop();
		recognition = null;
	}

	function handleMicPointerDown() {
		if (!hasSpeech || micState === 'processing') return;
		holdTimer = setTimeout(() => {
			isPushToTalk = true;
			startListening();
		}, 300);
	}

	function handleMicPointerUp() {
		clearTimeout(holdTimer);
		if (isPushToTalk) {
			stopListening();
			isPushToTalk = false;
		} else if (micState === 'idle') {
			startListening();
		} else if (micState === 'listening') {
			stopListening();
			micState = 'idle';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage(inputText);
		}
	}

	function clearHistory() {
		window.speechSynthesis?.cancel();
		$aiConversation = { messages: [], conversationId: null };
	}
</script>

<Modal>
	<svelte:fragment slot="title">
		<span class="title-row">
			<Icon icon={botIcon} height="1.1em" />
			{sel?.name || $lang('ai_assistant')}
		</span>
	</svelte:fragment>

	<div class="chat-container">
		<!-- messages -->
		<div class="messages" bind:this={messagesEl} data-exclude-drag-modal>
			{#if $aiConversation.messages.length === 0}
				<p class="empty">{$lang('ai_placeholder')}</p>
			{/if}

			{#each $aiConversation.messages as msg (msg.timestamp)}
				<div class="bubble {msg.role}">
					{#if msg.role === 'assistant'}
						<span class="bot-icon">
							<Icon icon={botIcon} height="1em" />
						</span>
					{/if}
					<span class="text">{msg.content}</span>
				</div>
			{/each}

			{#if micState === 'processing'}
				<div class="bubble assistant">
					<span class="bot-icon">
						<Icon icon={botIcon} height="1em" />
					</span>
					<span class="dots"><span>.</span><span>.</span><span>.</span></span>
				</div>
			{/if}
		</div>

		<!-- input -->
		<div class="input-area">
			{#if hasSpeech}
				<button
					class="mic-btn"
					class:listening={micState === 'listening'}
					class:processing={micState === 'processing'}
					on:pointerdown={handleMicPointerDown}
					on:pointerup={handleMicPointerUp}
					disabled={micState === 'processing'}
					aria-label={$lang('ai_listening')}
				>
					{#if micState === 'processing'}
						<Icon icon="fluent:spinner-ios-20-filled" height="1.4em" class="spin" />
					{:else}
						<Icon icon="fluent:mic-24-filled" height="1.4em" />
					{/if}
				</button>
			{/if}

			<input
				class="input"
				type="text"
				bind:value={inputText}
				placeholder={micState === 'listening'
					? $lang('ai_listening')
					: micState === 'processing'
						? $lang('ai_processing')
						: $lang('ai_placeholder')}
				disabled={micState !== 'idle'}
				on:keydown={handleKeydown}
				data-exclude-drag-modal
			/>

			<button
				class="send-btn"
				on:click={() => sendMessage(inputText)}
				disabled={!inputText.trim() || micState !== 'idle'}
				aria-label="Send"
			>
				<Icon icon="fluent:send-24-filled" height="1.3em" />
			</button>

			{#if $aiConversation.messages.length > 0}
				<button class="clear-btn" on:click={clearHistory} aria-label="Clear">
					<Icon icon="fluent:delete-24-regular" height="1.3em" />
				</button>
			{/if}
		</div>
	</div>
</Modal>

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		height: 60vh;
		min-height: 320px;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0.25rem 0.75rem;
		scrollbar-width: thin;
	}

	.empty {
		text-align: center;
		opacity: 0.45;
		margin: auto;
		font-size: 0.95rem;
	}

	.bubble {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		max-width: 88%;
		line-height: 1.45;
		font-size: 0.95rem;
	}

	.bubble.user {
		align-self: flex-end;
		flex-direction: row-reverse;
		background: var(--theme-navigate-background-color, rgba(255, 255, 255, 0.15));
		padding: 0.55rem 0.85rem;
		border-radius: 1.1rem 1.1rem 0.2rem 1.1rem;
	}

	.bubble.assistant {
		align-self: flex-start;
		background: var(--theme-button-background-color-off, rgba(0, 0, 0, 0.3));
		padding: 0.55rem 0.85rem;
		border-radius: 1.1rem 1.1rem 1.1rem 0.2rem;
	}

	.bot-icon {
		opacity: 0.6;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.text {
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* typing dots */
	.dots span {
		animation: blink 1.2s infinite;
		opacity: 0;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes blink {
		0%,
		80%,
		100% {
			opacity: 0;
		}
		40% {
			opacity: 1;
		}
	}

	/* input area */
	.input-area {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: var(--theme-colors-sidebar-border, 1px solid rgba(255, 255, 255, 0.3));
		flex-shrink: 0;
	}

	.input {
		flex: 1;
		border-radius: 0.6rem;
		padding: 0.6rem 0.9rem;
		font-size: 0.95rem;
		outline: none;
		min-width: 0;
	}

	.input:disabled {
		opacity: 0.5;
	}

	.mic-btn,
	.send-btn,
	.clear-btn {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		opacity: 0.7;
		transition:
			opacity 150ms ease,
			color 150ms ease;
	}

	.mic-btn:hover,
	.send-btn:hover,
	.clear-btn:hover {
		opacity: 1;
	}

	.mic-btn:disabled,
	.send-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.mic-btn.listening {
		color: #ef4444;
		opacity: 1;
		animation: pulse 1s ease-in-out infinite;
	}

	.mic-btn.processing {
		opacity: 0.4;
	}

	:global(.spin) {
		animation: spin 0.9s linear infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.18);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
