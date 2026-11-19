<script lang="ts">
	import { states, editMode, motion, lang, connection } from '$lib/Stores';
	import { getName } from '$lib/Utils';
	import Icon from '@iconify/svelte';
	import { callService } from 'home-assistant-js-websocket';
	import type { PowerSummaryItem, PowerSummaryGroup, PowerSummaryEntity } from '$lib/Types';

	export let sel: PowerSummaryItem | undefined = undefined;
	export let demo = false;

	interface GroupResult {
		group: PowerSummaryGroup;
		count: number;
		displayText: string;
		entities: { id: string; name: string }[];
	}

	let expandedGroup: number | null = null;

	// Demo data shown in the config modal preview
	const demoResults: GroupResult[] = [
		{
			group: { label: 'Lights', icon: 'mdi:lightbulb' } as any,
			count: 3,
			displayText: '',
			entities: []
		},
		{
			group: { label: 'Devices', icon: 'mdi:television' } as any,
			count: 0,
			displayText: '',
			entities: []
		}
	];

	$: results = demo ? demoResults : computeGroups(sel?.groups ?? [], $states);

	function computeGroups(
		groups: PowerSummaryGroup[],
		currentStates: typeof $states
	): GroupResult[] {
		return groups.map((group) => {
			let active: [string, any][];

			// Entity-based matching: if entities is specified, use it directly
			if (group.entities && group.entities.length > 0) {
				const entityIds = new Set(group.entities.map((e: PowerSummaryEntity) => e.entity_id));
				active = Object.entries(currentStates ?? {})
					.filter(([id, entity]) => {
						if (!entityIds.has(id)) return false;
						const entry = group.entities!.find((e: PowerSummaryEntity) => e.entity_id === id);
						const onState = entry?.on_state ?? 'on';
						return entity.state === onState;
					});
			} else {
				// Legacy domain-based matching
				const domains = group.domains ?? [];
				const excluded = new Set(group.exclude ?? []);
				const onStates = new Set(group.on_states ?? ['on']);

				active = Object.entries(currentStates ?? {})
					.filter(([id, entity]) => {
						const domain = id.split('.')[0];
						return domains.includes(domain) && !excluded.has(id) && onStates.has(entity.state);
					});
			}

			const count = active.length;
			let displayText = '';
			if (count === 1) {
				const eid = active[0][0];
				const customLib = group.entity_labels?.[eid];
				displayText = customLib ?? getName(undefined, active[0][1]) ?? eid.split('.')[1];
			}

			const entities = active.map(([id, entity]) => ({
				id,
				name: group.entity_labels?.[id] ?? getName(undefined, entity) ?? id.split('.')[1]
			}));

			return { group, count, displayText, entities };
		});
	}

	function closeEntity(event: MouseEvent, entityId: string) {
		event.stopPropagation();
		if ($connection) callService($connection, 'homeassistant', 'turn_off', { entity_id: entityId });
	}

	function handleGroupClick(event: MouseEvent, index: number, count: number) {
		if ($editMode || demo) return;
		event.stopPropagation();
		if (count > 0) expandedGroup = expandedGroup === index ? null : index;
	}
</script>

{#if sel?.groups?.length || demo || $editMode}
	<div
		class="container"
		style:padding="var(--theme-sidebar-item-padding)"
		style:display="flex"
		style:flex-direction="column"
		style:gap="0.4rem"
	>
		{#each results as { group, count, displayText, entities }, index}
			<button
				type="button"
				class="group-row"
				class:clickable={count > 0 && !$editMode && !demo}
				aria-expanded={expandedGroup === index}
				on:click={(event) => handleGroupClick(event, index, count)}
				style:opacity={count === 0 && !$editMode ? '0.3' : '1'}
				style:transition="opacity {$motion}ms ease"
			>
				<span class="group-icon">
					<Icon icon={group.icon || 'mdi:circle-small'} height="1em" width="1em" />
				</span>

				<div class="group-body">
					{#if group.label}
						<span class="group-label">{group.label}</span>
					{/if}
					{#if displayText}
						<span class="group-text">{displayText}</span>
					{/if}
				</div>

				{#if count > 0 || $editMode}
					<span class="badge" class:badge-zero={count === 0}>{count}</span>
				{/if}
			</button>
			{#if expandedGroup === index && count > 0 && !$editMode && !demo}
				<div class="entity-list">
					{#each entities as entity (entity.id)}
						<div class="entity-row">
							<span>{entity.name}</span>
							<button class="turn-off" aria-label={`关闭 ${entity.name}`} title="关闭" on:click={(event) => closeEntity(event, entity.id)}>
								<Icon icon="mdi:power" height="1em" width="1em" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		{/each}

		{#if $editMode && (!sel?.groups || sel.groups.length === 0)}
			<span class="placeholder">{$lang('power_summary')}</span>
		{/if}
	</div>
{/if}

<style>
	.container {
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.1);
	}

	.group-row {
		width: 100%;
		border: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 0.6rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.group-row.clickable { cursor: pointer; }
	.entity-list {
		margin: -0.2rem 0 0 1.8rem;
		padding: 0.2rem 0.5rem;
		background: rgba(0, 0, 0, 0.12);
		border-radius: 0.5rem;
	}
	.entity-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.2rem; }
	.entity-row > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.turn-off {
		border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer;
		display: grid; place-items: center; padding: 0.35rem; font-size: 1.1rem;
	}
	.turn-off:hover { background: rgba(255, 255, 255, 0.16); }

	.group-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		font-size: 1.2rem;
		width: 1.2rem;
		color: rgba(255, 255, 255, 0.75);
	}

	.group-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.group-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.group-text {
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badge {
		flex-shrink: 0;
		background: var(--theme-colors-sidebar-item-background, rgba(255, 255, 255, 0.15));
		border-radius: 999px;
		padding: 0 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		min-width: 1.4rem;
		text-align: center;
		color: var(--theme-colors-sidebar-font-color, inherit);
	}

	.badge-zero {
		opacity: 0.4;
	}

	.placeholder {
		color: rgba(255, 255, 255, 0.25);
		font-size: 0.9rem;
		padding: 0.5rem 0.75rem;
	}
</style>
