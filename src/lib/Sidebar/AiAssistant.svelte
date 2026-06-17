<script lang="ts">
	import { lang, aiConversation, configuration } from '$lib/Stores';
	import { modals, openModal } from 'svelte-modals';
	import Icon from '@iconify/svelte';
	import type { AiAssistantItem } from '$lib/Types';
	import { toSpeechLang } from '$lib/Utils';
	import { onDestroy } from 'svelte';

	export let sel: AiAssistantItem;

	$: unread = $aiConversation.messages.length > 0;
	$: icon = sel?.icon || 'fluent:bot-24-filled';

	const SpeechRecognition =
		typeof window !== 'undefined'
			? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
			: null;

	const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

	let wakeRec: any = null;
	let destroyed = false;
	let restartTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleRestart(ms: number) {
		if (restartTimer !== null) {
			clearTimeout(restartTimer);
			restartTimer = null;
		}
		if (!destroyed && sel?.wake_word) {
			restartTimer = setTimeout(() => {
				restartTimer = null;
				startWakeListener();
			}, ms);
		}
	}

	// Central lifecycle: pause when any modal is open (releases the mic), restart when closed
	$: if (typeof window !== 'undefined') {
		if ($modals.length > 0) {
			if (restartTimer !== null) {
				clearTimeout(restartTimer);
				restartTimer = null;
			}
			if (wakeRec) {
				wakeRec.stop();
				wakeRec = null;
			}
		} else if (sel?.wake_word && !wakeRec && !destroyed && restartTimer === null) {
			scheduleRestart(300);
		} else if (!sel?.wake_word) {
			if (restartTimer !== null) {
				clearTimeout(restartTimer);
				restartTimer = null;
			}
			if (wakeRec) {
				wakeRec.stop();
				wakeRec = null;
			}
		}
	}

	function startWakeListener() {
		if (
			!SpeechRecognition ||
			!sel?.wake_word ||
			destroyed ||
			wakeRec ||
			isMobile ||
			$modals.length > 0
		)
			return;

		try {
			const rec = new SpeechRecognition();
			rec.lang = toSpeechLang($configuration?.locale);
			rec.continuous = true;
			rec.interimResults = true;

			rec.onresult = (event: any) => {
				if ($modals.length > 0) return;
				const keyword = sel?.wake_word?.toLowerCase().trim();
				if (!keyword) return;
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const transcript = event.results[i][0].transcript.toLowerCase();
					console.debug(
						'[Wake word] heard:',
						JSON.stringify(transcript),
						'| looking for:',
						JSON.stringify(keyword)
					);
					if (transcript.includes(keyword)) {
						wakeRec = null;
						rec.stop();
						openModal(() => import('$lib/Modal/AiAssistantModal.svelte'), {
							sel,
							autoListen: true
						});
						break;
					}
				}
			};

			rec.onerror = (event: any) => {
				wakeRec = null;
				// Real errors: schedule long delay here so the reactive block doesn't add a short one
				if (event.error !== 'no-speech') {
					scheduleRestart(2000);
				}
				// For 'no-speech' (silence timeout): wakeRec=null triggers reactive block → 300ms restart
			};

			rec.onend = () => {
				wakeRec = null;
				// wakeRec=null triggers the reactive block which schedules the restart
			};

			wakeRec = rec;
			rec.start();
		} catch {
			wakeRec = null;
		}
	}

	onDestroy(() => {
		destroyed = true;
		if (restartTimer !== null) {
			clearTimeout(restartTimer);
			restartTimer = null;
		}
		wakeRec?.stop();
		wakeRec = null;
	});
</script>

<div class="container" class:active={unread}>
	<span class="icon">
		<Icon {icon} height="none" />
	</span>
	<span class="label">{sel?.name || $lang('ai_assistant')}</span>
	{#if wakeRec}
		<span class="wake-indicator" title={$lang('ai_listening')} />
	{/if}
</div>

<style>
	.container {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: var(--theme-sidebar-item-padding);
		width: 100%;
		cursor: pointer;
		border-radius: var(--theme-border-radius, 0.4rem);
		transition: background-color 150ms ease;
	}

	.container:hover,
	.container.active {
		background-color: var(--theme-navigate-background-color);
	}

	.icon {
		width: 1.5rem;
		height: 1.5rem;
		min-width: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.active .icon {
		color: var(--theme-colors-accent, #60a5fa);
	}

	.label {
		font-size: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.wake-indicator {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background-color: #ef4444;
		flex-shrink: 0;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.3);
		}
	}
</style>
