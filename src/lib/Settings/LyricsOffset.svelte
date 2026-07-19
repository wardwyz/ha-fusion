<script lang="ts">
	import { configuration, lang, motion } from '$lib/Stores';
	import { slide } from 'svelte/transition';

	let offsetValue: number = $configuration?.lyrics_offset ?? 0;

	$: $configuration.lyrics_offset = offsetValue;

	function adjust(delta: number) {
		const newVal = offsetValue + delta;
		if (newVal >= -10 && newVal <= 10) {
			offsetValue = Math.round(newVal * 10) / 10;
		}
	}
</script>

<div class="container">
	<div>
		<h2>{$lang('lyrics_offset') || '歌词偏移'}</h2>
		<p>{offsetValue >= 0 ? '+' : ''}{offsetValue.toFixed(1)} 秒</p>
	</div>

	<div class="controls">
		<button
			class="btn"
			on:click={() => adjust(-0.5)}
			disabled={offsetValue <= -10}
		>-</button>
		<div class="value">{offsetValue >= 0 ? '+' : ''}{offsetValue.toFixed(1)}</div>
		<button
			class="btn"
			on:click={() => adjust(0.5)}
			disabled={offsetValue >= 10}
		>+</button>
		<button class="btn-reset" on:click={() => (offsetValue = 0)} disabled={offsetValue === 0}>
			重置
		</button>
	</div>

	<input type="hidden" bind:value={offsetValue} name="lyrics_offset" />
</div>

<style>
	.container {
		display: grid;
		gap: 0.5rem;
	}

	h2 {
		margin: 0;
	}

	p {
		margin-block-end: 0.6rem;
		font-size: 0.9rem;
		opacity: 0.75;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(255, 255, 255, 0.08);
		color: inherit;
		font-size: 1.3rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.18);
	}

	.btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.value {
		font-size: 1.1rem;
		font-weight: 500;
		min-width: 4rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.btn-reset {
		padding: 0.35rem 0.7rem;
		border-radius: 0.35rem;
		border: none;
		background: rgba(255, 255, 255, 0.1);
		color: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-reset:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
	}

	.btn-reset:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
