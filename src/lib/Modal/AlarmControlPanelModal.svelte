<script lang="ts">
	import { states, lang, ripple, connection, motion } from '$lib/Stores';
	import Modal from '$lib/Modal/Index.svelte';
	import StateLogic from '$lib/Components/StateLogic.svelte';
	import { getName } from '$lib/Utils';
	import Icon from '@iconify/svelte';
	import Ripple from 'svelte-ripple';
	import { callService } from 'home-assistant-js-websocket';
	import { onDestroy } from 'svelte';

	export let isOpen: boolean;
	export let sel: any;

	$: entity = $states[sel?.entity_id];
	$: entity_id = entity?.entity_id;
	$: state = entity?.state;
	$: attributes = entity?.attributes;

	// HA AlarmControlPanelEntityFeature bitmask values
	const FEATURES = {
		ARM_HOME: 1,
		ARM_AWAY: 2,
		ARM_NIGHT: 4,
		ARM_VACATION: 8,
		ARM_CUSTOM_BYPASS: 16,
		TRIGGER: 32
	};

	$: supported_features = attributes?.supported_features ?? 0;
	$: code_format = attributes?.code_format ?? null; // null | 'number' | 'text'
	$: code_arm_required = attributes?.code_arm_required ?? true;
	$: code_disarm_required = attributes?.code_disarm_required ?? true;

	$: supports = (feature: number) => (supported_features & feature) !== 0;

	// is the current state "armed" (any variant)?
	$: isArmed = state !== 'disarmed';

	// does the current action require a code?
	// if armed → we're disarming → check code_disarm_required
	// if disarmed → we're arming → check code_arm_required
	$: needsCode =
		code_format !== null && (isArmed ? code_disarm_required : code_arm_required);

	$: showKeypad = needsCode && code_format === 'number';
	$: showTextInput = needsCode && code_format === 'text';

	let code = '';
	let reject = false;
	let selectedService: string | undefined;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let wizardStep = 0; // 0: mode selection, 1: code input

	function addCode(key: number) {
		code += key;
	}

	function clearCode() {
		code = '';
	}

	function goBackToModes() {
		wizardStep = 0;
		clearCode();
	}

	async function executeService(service: string) {
		try {
			const serviceData: Record<string, string> = { entity_id };
			// only include code if it's actually required and provided
			if (needsCode && code) serviceData.code = code;

			await callService($connection, 'alarm_control_panel', service, serviceData);

			selectedService = undefined;
			clearCode();
			wizardStep = 0;
		} catch (error: any) {
			if (error.message === 'Invalid alarm code provided') {
				reject = true;
				timeout = setTimeout(() => {
					reject = false;
				}, 600);
			}
		}
	}

	async function handleAction(service: string) {
		if (needsCode) {
			// select mode and proceed to keypad
			selectedService = service;
			wizardStep = 1;
		} else {
			// no code needed: execute immediately
			await executeService(service);
		}
	}

	async function enterCode() {
		if (needsCode && !code) return;
		const service = selectedService ?? (isArmed ? 'alarm_disarm' : 'alarm_arm_away');
		await executeService(service);
	}

	onDestroy(() => {
		clearTimeout(timeout);
	});

	// build options list filtered by supported_features
	// separate arm modes from disarm
	$: armModes = [
		supports(FEATURES.ARM_HOME) && {
			id: 'alarm_arm_home',
			icon: 'mdi:home',
			label: $lang('alarm_modes_armed_home')
		},
		supports(FEATURES.ARM_AWAY) && {
			id: 'alarm_arm_away',
			icon: 'mdi:lock',
			label: $lang('alarm_modes_armed_away')
		},
		supports(FEATURES.ARM_NIGHT) && {
			id: 'alarm_arm_night',
			icon: 'mdi:moon-waning-crescent',
			label: $lang('alarm_modes_armed_night')
		},
		supports(FEATURES.ARM_VACATION) && {
			id: 'alarm_arm_vacation',
			icon: 'mdi:airplane',
			label: $lang('alarm_modes_armed_vacation')
		},
		supports(FEATURES.ARM_CUSTOM_BYPASS) && {
			id: 'alarm_arm_custom_bypass',
			icon: 'mdi:shield-half-full',
			label: $lang('alarm_modes_armed_custom_bypass')
		}
	].filter(Boolean) as { id: string; icon: string; label: string }[];

	$: disarmMode = {
		id: 'alarm_disarm',
		icon: 'mdi:shield-off',
		label: $lang('alarm_modes_disarmed')
	};

	$: modeOptions = [...armModes, disarmMode];
</script>

{#if isOpen}
	<Modal>
		<svelte:fragment slot="title">
			<div class="title-row">
				{#if wizardStep === 1}
					<button type="button" class="header-back" on:mousedown|preventDefault|stopPropagation={() => {wizardStep = 0; clearCode();}} on:click|preventDefault|stopPropagation aria-label="back">
						<Icon icon="gravity-ui:chevron-left" height="none" style="width: 1.1rem;" />
					</button>
				{/if}
				<span class="title-text">{getName(sel, entity)}</span>
			</div>
		</svelte:fragment>

		<div class="wizard-container">
			<!-- State indicator (compact, heading removed) -->
			<span class:arming={state === 'arming'} class="state-compact">
				<StateLogic entity_id={sel?.entity_id} selected={sel} />
			</span>

			<!-- Wizard Step 0: Mode Selection -->
			{#if wizardStep === 0}
				<div class="wizard-step">
					<h2>{$lang('alarm_modes_label')}</h2>

					<div class="mode-buttons">
						{#each armModes as option}
							<button
								class="mode-btn"
								class:active={selectedService === option.id}
								on:click={() => handleAction(option.id)}
								use:Ripple={$ripple}
							>
								<Icon icon={option.icon} height="none" style="width: 1.4rem;" />
								{option.label}
							</button>
						{/each}

						{#if armModes.length > 0}
							<div class="mode-divider" />
						{/if}

						<button
							class="mode-btn disarm-btn"
							class:active={selectedService === disarmMode.id}
							on:click={() => handleAction(disarmMode.id)}
							use:Ripple={$ripple}
						>
							<Icon icon={disarmMode.icon} height="none" style="width: 1.4rem;" />
							{disarmMode.label}
						</button>
					</div>
				</div>
			{/if}

			<!-- Wizard Step 1: Code Input -->
			{#if wizardStep === 1 && needsCode && selectedService}
				<div class="wizard-step">
					<h3 class="step-title">
						{modeOptions.find((opt) => opt.id === selectedService)?.label}
					</h3>

					{#if showTextInput}
						<div class="keypad-container">
							<input
								type="text"
								class:reject
								bind:value={code}
								placeholder={$lang('code')}
								on:keydown={(e) => e.key === 'Enter' && enterCode()}
								readonly
							/>
							<div class="text-confirm">
								<button
									on:click={clearCode}
									use:Ripple={$ripple}
									style:background-color={code === '' ? '' : '#422522'}
									style:transition="background-color {$motion}ms ease"
								>
									<Icon
										icon="gravity-ui:xmark"
										height="none"
										style={`width: 1.65rem; ${code === '' ? '' : `color: #e15241;`}`}
									/>
								</button>
								<button on:click={enterCode} use:Ripple={$ripple} style:background-color="#293828">
									<Icon icon="gravity-ui:check" height="none" style="width: 1.8rem; color: #67ad5b;" />
								</button>
							</div>
						</div>
					{:else if showKeypad}
						<div class="keypad-container">
							<input type="password" class:reject bind:value={code} readonly />
							<div class="buttons">
								{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as digit}
									<button on:click={() => addCode(digit)} use:Ripple={$ripple}>
										{digit}
									</button>
								{/each}

								<button
									on:click={clearCode}
									use:Ripple={$ripple}
									style:background-color={code === '' ? '' : '#422522'}
									style:transition="background-color {$motion}ms ease"
								>
									<Icon
										icon="gravity-ui:xmark"
										height="none"
										style={`width: 1.65rem; ${
											code === '' ? '' : `color: #e15241; transition: background-color ${$motion}ms ease;`
										}`}
									/>
								</button>

								<button on:click={() => addCode(0)} use:Ripple={$ripple}>0</button>

								<button on:click={enterCode} use:Ripple={$ripple} style:background-color="#293828">
									<Icon icon="gravity-ui:check" height="none" style="width: 1.8rem; color: #67ad5b;" />
								</button>
							</div>
						</div>
					{/if}

				</div>
			{/if}
		</div>
	</Modal>
{/if}

<style>
	.wizard-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		padding: 0.35rem 0; 
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-back {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: inherit;
		padding: 0.35rem 0.35rem;
		margin: 0;
		border-radius: 0.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 150ms ease, border-color 150ms ease;
		pointer-events: all;
		z-index: 10;
		flex-shrink: 0;
	}

	.header-back:hover {
		background-color: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.25);
	}

	.title-text {
		font-weight: 600;
		font-size: 1rem;
		line-height: 1;
		flex: 1;
	}

	.state-compact {
		display: flex;
		justify-content: center;
		font-size: 0.95rem;
		opacity: 0.9;
		margin: 0;
	}

	.wizard-step {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 0.6rem;
		min-height: 0;
		overflow: hidden;
	}

	.step-title {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(255, 255, 255, 0.75);
		text-align: center;
	}

	.mode-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-bottom: 0.4rem;
		overflow-y: auto;
		flex: 1;
	}

	.mode-divider {
		height: 1px;
		background-color: rgba(255, 255, 255, 0.1);
		margin: 0.25rem 0;
	}

	.mode-btn {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.9rem;
		background-color: var(--theme-button-background-color-off);
		border-radius: 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: white;
		font-size: 0.98rem;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background-color 150ms ease;
		flex-shrink: 0;
	}

	.mode-btn.disarm-btn {
		opacity: 0.85;
	}

	.mode-btn.active {
		border-color: rgba(255, 255, 255, 0.35);
		background-color: rgba(255, 255, 255, 0.06);
	}

	.mode-btn:hover {
		background-color: rgba(255, 255, 255, 0.04);
	}

	.keypad-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 0.9rem;
		justify-content: center;
		align-items: center;
		min-height: 0;
	}

	input[type='password'],
	input[type='text'] {
		text-align: center;
		font-size: 2.1rem;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.18);
		color: white;
		max-width: 18rem;
		width: 100%;
		outline: none;
		border-radius: 0.4rem 0.4rem 0 0;
		background: var(--theme-button-background-color-off);
		padding: 0.6rem 0;
		letter-spacing: 0.45rem;
	}

	input[type='text'] {
		font-size: 1.45rem;
		padding: 0.6rem 0.4rem;
		letter-spacing: normal;
	}

	.buttons {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		column-gap: 0.9rem;
		row-gap: 0.9rem;
		margin: 0 auto;
	}

	.text-confirm {
		display: flex;
		justify-content: center;
		gap: 1.2rem;
	}

	button {
		cursor: pointer;
		user-select: none;
		background-color: var(--theme-button-background-color-off);
		border-radius: 50%;
		width: 3.2rem;
		height: 3.2rem;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 1.2rem;
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.16);
		transition: background-color 150ms ease;
	}

	button:hover {
		background-color: rgba(255, 255, 255, 0.07);
	}

	.reject {
		animation: shake 500ms linear;
	}

	@keyframes shake {
		8%,
		41% {
			transform: translateX(-10px);
		}
		25%,
		58% {
			transform: translateX(10px);
		}
		75% {
			transform: translateX(-5px);
		}
		92% {
			transform: translateX(5px);
		}
		0%,
		100% {
			transform: translateX(0);
		}
	}

	.arming {
		animation: blink 800ms linear infinite;
	}

	@keyframes blink {
		0% {
			opacity: 0;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	@media (max-width: 1024px) {
		.buttons {
			grid-template-columns: repeat(3, 1fr);
			column-gap: 0.8rem;
			row-gap: 0.8rem;
		}

		button {
			width: 3.2rem;
			height: 3.2rem;
			font-size: 1.1rem;
		}

		input[type='password'],
		input[type='text'] {
			font-size: 2rem;
		}

		.mode-btn {
			padding: 0.6rem 0.8rem;
			font-size: 0.95rem;
		}
	}

	@media (max-width: 768px) {
		.buttons {
			grid-template-columns: repeat(3, 1fr);
			column-gap: 0.6rem;
			row-gap: 0.6rem;
		}

		button {
			width: 2.8rem;
			height: 2.8rem;
			font-size: 0.95rem;
		}

		input[type='password'],
		input[type='text'] {
			font-size: 1.8rem;
			max-width: 15rem;
		}

		.mode-btn {
			padding: 0.5rem 0.7rem;
			font-size: 0.9rem;
		}

		.text-confirm {
			gap: 1rem;
		}
	}
</style>
