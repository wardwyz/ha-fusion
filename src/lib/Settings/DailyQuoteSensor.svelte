<script lang="ts">
	import { configuration, lang } from '$lib/Stores';

	let sensorId: string = $configuration?.daily_quote_sensor ?? '';
</script>

<div class="container">
	<div>
		<h2>{$lang('daily_quote_sensor') || '每日一言传感器'}</h2>
		<p>输入 Home Assistant 中提供每日一言的 sensor 实体 ID，例如 sensor.daily_quote</p>
	</div>

	<input
		type="text"
		class="sensor-input"
		bind:value={sensorId}
		placeholder="sensor.daily_quote"
	/>

	<input type="hidden" bind:value={sensorId} name="daily_quote_sensor" />
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

	.sensor-input {
		padding: 0.5rem 0.7rem;
		border-radius: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(255, 255, 255, 0.08);
		color: inherit;
		font-size: 0.95rem;
		font-family: inherit;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}

	.sensor-input:focus {
		border-color: rgba(255, 255, 255, 0.4);
	}

	.sensor-input::placeholder {
		opacity: 0.4;
	}
</style>
