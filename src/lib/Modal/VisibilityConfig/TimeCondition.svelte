<script lang="ts">
	import { lang } from '$lib/Stores';
	import type { Condition } from '$lib/Types';

	export let item: Condition;
	export let items: Condition[];

	/**
	 * Updates `after` or `before` value
	 */
	function handleTime(id: number | undefined, target: EventTarget | null, key: 'after' | 'before') {
		const input = target as HTMLInputElement;
		const value = input.value;

		items = items.map((condition: Condition) => {
			if (id === condition.id) {
				// delete key if empty
				if (value === '') {
					const _condition = { ...condition };
					delete _condition[key];
					return _condition;
				} else {
					return { ...condition, [key]: value };
				}
			}
			return condition;
		});
	}
</script>

<div>
	<span>
		<label for="after-{item?.id}">{$lang('after')}</label>
		<input
			id="after-{item?.id}"
			data-modal
			type="time"
			value={item?.after ?? ''}
			on:input={(event) => handleTime(item?.id, event?.target, 'after')}
			autocomplete="off"
		/>
	</span>

	<span>
		<label for="before-{item?.id}">{$lang('before')}</label>
		<input
			id="before-{item?.id}"
			data-modal
			type="time"
			value={item?.before ?? ''}
			on:input={(event) => handleTime(item?.id, event?.target, 'before')}
			autocomplete="off"
		/>
	</span>
</div>

<style>
	div {
		display: flex;
		width: 100%;
		gap: 1rem;
	}

	span {
		width: 50%;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	input[type='time'] {
		color-scheme: dark;
	}
</style>
