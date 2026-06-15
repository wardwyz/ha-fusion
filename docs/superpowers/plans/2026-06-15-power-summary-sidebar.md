# Power Summary Sidebar Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `power_summary` sidebar item type that shows groups of HA entities filtered by domain, displaying the active count or name per group with a numeric badge.

**Architecture:** A display component (`Sidebar/PowerSummary.svelte`) derives active-entity data reactively from `$states` for each configured group; a config modal (`Modal/PowerSummaryConfig.svelte`) provides inline group editing with domain chips, exclusion picker, on-state chips, and drag-and-drop group reordering. Integration follows the identical pattern used by every other sidebar type: types in `Types.ts`, dynamic import in `Sidebar/Index.svelte`, type-picker entry in `Modal/SidebarItemConfig.svelte`.

**Tech Stack:** Svelte 4, TypeScript 5, SvelteKit 2, `svelte-dnd-action` (already a dep), `@iconify/svelte`, `svelte-ripple`, existing project utilities (`updateObj`, `generateId`, `getName` from `Utils.ts`).

---

## File Map

| File | Op | Responsibility |
|---|---|---|
| `src/lib/Types.ts` | modify | Add `PowerSummaryGroup`, `PowerSummaryItem` interfaces; extend `SidebarItem` union |
| `static/translations/en.json` | modify | Add 6 UI string keys |
| `src/lib/Sidebar/PowerSummary.svelte` | create | Display: reactive group computation, badge, dimmed state |
| `src/lib/Sidebar/Index.svelte` | modify | Dynamic import + template block + `handleClick` case |
| `src/lib/Modal/PowerSummaryConfig.svelte` | create | Config modal: group list, per-group editor, DnD reordering |
| `src/lib/Modal/SidebarItemConfig.svelte` | modify | Type-picker entry + `handleClick` switch case |

---

## Task 1: TypeScript Interfaces

**Files:**
- Modify: `src/lib/Types.ts`

- [ ] **Step 1: Add `PowerSummaryGroup` and `PowerSummaryItem` interfaces**

Open `src/lib/Types.ts`. Find the `AiAssistantItem` interface (around line 171). Insert the two new interfaces **before** it:

```typescript
export interface PowerSummaryGroup {
	id?: number;
	label?: string;
	icon?: string;
	domains?: string[];
	exclude?: string[];
	on_states?: string[];
	count_suffix?: string;
}

export interface PowerSummaryItem {
	type?: string;
	id?: number;
	groups?: PowerSummaryGroup[];
	hide_mobile?: boolean;
}
```

- [ ] **Step 2: Add `PowerSummaryItem` to the `SidebarItem` union**

Find the `SidebarItem` type (around line 137):

```typescript
export type SidebarItem = BarItem &
	BinarySensorItem &
	...
	DividerItem &
	AiAssistantItem;
```

Change the last line to add `PowerSummaryItem`:

```typescript
export type SidebarItem = BarItem &
	BinarySensorItem &
	CameraItem &
	DateItem &
	GraphItem &
	HistoryItem &
	IframeItem &
	ImageItem &
	NavigateItem &
	RadialItem &
	SensorItem &
	TemplateItem &
	TimeItem &
	WeatherItem &
	WeatherForecastItem &
	DividerItem &
	AiAssistantItem &
	PowerSummaryItem;
```

- [ ] **Step 3: Verify types compile**

```bash
pnpm check
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/Types.ts
git commit -m "feat(types): add PowerSummaryGroup and PowerSummaryItem interfaces"
```

---

## Task 2: Translation Keys

**Files:**
- Modify: `static/translations/en.json`

- [ ] **Step 1: Add the 6 new keys**

Open `static/translations/en.json`. Add the following entries in alphabetical order among the existing keys:

```json
"add_group": "Add group",
"count_suffix": "Suffix",
"domains": "Domains",
"exclude": "Exclude entities",
"on_states": "On states",
"power_summary": "Power Summary",
```

Note: `domains` and `exclude` may already exist — grep first:
```bash
grep -n '"domains"\|"exclude"\|"on_states"\|"power_summary"\|"add_group"\|"count_suffix"' static/translations/en.json
```
Only add the keys that are missing.

- [ ] **Step 2: Commit**

```bash
git add static/translations/en.json
git commit -m "feat(i18n): add power_summary translation keys"
```

---

## Task 3: Display Component

**Files:**
- Create: `src/lib/Sidebar/PowerSummary.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/Sidebar/PowerSummary.svelte` with the following content:

```svelte
<script lang="ts">
	import { states, editMode, motion } from '$lib/Stores';
	import { getName } from '$lib/Utils';
	import Icon, { loadIcon } from '@iconify/svelte';
	import type { PowerSummaryItem, PowerSummaryGroup } from '$lib/Types';

	export let sel: PowerSummaryItem | undefined = undefined;
	export let demo = false;

	interface GroupResult {
		group: PowerSummaryGroup;
		count: number;
		displayText: string;
	}

	// Demo data shown in the config modal preview
	const demoResults: GroupResult[] = [
		{
			group: { label: 'Luci', icon: 'mdi:lightbulb', count_suffix: 'accese' } as any,
			count: 3,
			displayText: '3 accese'
		},
		{
			group: { label: 'Dispositivi', icon: 'mdi:television' } as any,
			count: 0,
			displayText: ''
		}
	];

	$: results = demo ? demoResults : computeGroups(sel?.groups ?? [], $states);

	function computeGroups(groups: PowerSummaryGroup[], currentStates: typeof $states): GroupResult[] {
		return groups.map((group) => {
			const domains = group.domains ?? [];
			const excluded = new Set(group.exclude ?? []);
			const onStates = new Set(group.on_states ?? ['on']);

			const active = Object.entries(currentStates)
				.filter(([id, entity]) => {
					const domain = id.split('.')[0];
					return domains.includes(domain) && !excluded.has(id) && onStates.has(entity.state);
				})
				.map(([, entity]) => entity);

			const count = active.length;
			let displayText = '';
			if (count === 1) {
				displayText = getName(undefined, active[0]) ?? active[0].entity_id.split('.')[1];
			} else if (count > 1) {
				displayText = group.count_suffix ? `${count} ${group.count_suffix}` : String(count);
			}

			return { group, count, displayText };
		});
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
		{#each results as { group, count, displayText }}
			<div
				class="group-row"
				style:opacity={count === 0 && !$editMode ? '0.3' : '1'}
				style:transition="opacity {$motion}ms ease"
			>
				<span class="group-icon">
					{#if group.icon}
						{#await loadIcon(group.icon) then resolvedIcon}
							<Icon icon={resolvedIcon} height="1em" width="1em" />
						{/await}
					{:else}
						<Icon icon="mdi:circle-small" height="1em" width="1em" />
					{/if}
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
			</div>
		{/each}

		{#if $editMode && (!sel?.groups || sel.groups.length === 0)}
			<span class="placeholder">Power Summary</span>
		{/if}
	</div>
{/if}

<style>
	.container {
		pointer-events: none;
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.1);
		font-family: 'Inter Variable';
	}

	.group-row {
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 0.6rem;
		padding: 0.5rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

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
		opacity: 0.5;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.group-text {
		font-size: 0.9rem;
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
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/Sidebar/PowerSummary.svelte
git commit -m "feat(sidebar): add PowerSummary display component"
```

---

## Task 4: Register in Sidebar/Index.svelte

**Files:**
- Modify: `src/lib/Sidebar/Index.svelte`

- [ ] **Step 1: Declare the component variable**

In the `<script>` block, after `let WeatherForecast: ComponentType;` (around line 38), add:

```typescript
let PowerSummary: ComponentType;
```

- [ ] **Step 2: Add to the imports map**

In the `imports` object (around line 40), after the `weather_forecast` entry, add:

```typescript
power_summary: () =>
    import('$lib/Sidebar/PowerSummary.svelte').then((c) => (PowerSummary = c.default)),
```

- [ ] **Step 3: Add the config modal case to `handleClick`**

In `handleClick` (around line 104), after the `weather_forecast` else-if block and before the final `else`, add:

```typescript
} else if (sel?.type === 'power_summary') {
    openModal(() => import('$lib/Modal/PowerSummaryConfig.svelte'), { sel });
```

- [ ] **Step 4: Add the template rendering block**

In the `{#each $dashboard.sidebar as item}` block, after the `<!-- WEATHER FORECAST -->` block (around line 450) and before the closing `{/if}`, add:

```svelte
<!-- POWER SUMMARY -->
{:else if PowerSummary && item?.type === 'power_summary' && !hide_mobile}
    <div on:click={() => handleClick(item?.id)} on:keydown role="button" tabindex="0">
        <svelte:component this={PowerSummary} sel={item} />
    </div>
```

- [ ] **Step 5: Verify types compile**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/Sidebar/Index.svelte
git commit -m "feat(sidebar): register power_summary type in sidebar index"
```

---

## Task 5: Config Modal

**Files:**
- Create: `src/lib/Modal/PowerSummaryConfig.svelte`

- [ ] **Step 1: Create the config modal**

Create `src/lib/Modal/PowerSummaryConfig.svelte`:

```svelte
<script lang="ts">
	import { dashboard, entityList, lang, record, ripple, states } from '$lib/Stores';
	import { onDestroy } from 'svelte';
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import PowerSummary from '$lib/Sidebar/PowerSummary.svelte';
	import Select from '$lib/Components/Select.svelte';
	import InputClear from '$lib/Components/InputClear.svelte';
	import ConfigButtons from '$lib/Modal/ConfigButtons.svelte';
	import Modal from '$lib/Modal/Index.svelte';
	import Ripple from 'svelte-ripple';
	import Icon from '@iconify/svelte';
	import { updateObj } from '$lib/Utils';
	import type { PowerSummaryItem, PowerSummaryGroup } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: PowerSummaryItem;

	// Ensure groups array exists and every group has an id for DnD
	if (!sel.groups) sel.groups = [];
	sel.groups = sel.groups.map((g) =>
		g.id ? g : { ...g, id: Math.random() * 1e9 | 0 }
	);

	let expandedIndex: number | null = sel.groups.length === 0 ? null : 0;

	const DOMAINS = ['light', 'switch', 'climate', 'media_player', 'sensor', 'input_boolean', 'fan'];
	const ON_STATES = ['on', 'playing', 'heat', 'cool', 'fan_only', 'dry', 'auto', 'idle', 'paused'];

	function save() {
		$dashboard = $dashboard;
	}

	function set(key: string, event?: any) {
		sel = updateObj(sel, key, event);
		save();
	}

	function setGroup(index: number, key: keyof PowerSummaryGroup, value: any) {
		if (!sel.groups) return;
		(sel.groups[index] as any)[key] = value === undefined ? undefined : value;
		sel.groups = [...sel.groups];
		save();
	}

	function removeGroupProp(index: number, key: keyof PowerSummaryGroup) {
		if (!sel.groups) return;
		delete (sel.groups[index] as any)[key];
		sel.groups = [...sel.groups];
		save();
	}

	function addGroup() {
		const newGroup: PowerSummaryGroup = {
			id: Math.random() * 1e9 | 0,
			label: '',
			icon: 'mdi:circle',
			domains: [],
			on_states: ['on'],
			exclude: []
		};
		sel.groups = [...(sel.groups ?? []), newGroup];
		expandedIndex = sel.groups.length - 1;
		save();
	}

	function removeGroup(index: number) {
		sel.groups = sel.groups?.filter((_, i) => i !== index);
		if (expandedIndex !== null && expandedIndex >= (sel.groups?.length ?? 0)) {
			expandedIndex = (sel.groups?.length ?? 1) - 1;
		}
		save();
	}

	function toggleDomain(index: number, domain: string) {
		if (!sel.groups) return;
		const group = sel.groups[index];
		const current = group.domains ?? [];
		const next = current.includes(domain)
			? current.filter((d) => d !== domain)
			: [...current, domain];
		setGroup(index, 'domains', next);
	}

	function toggleOnState(index: number, state: string) {
		if (!sel.groups) return;
		const group = sel.groups[index];
		const current = group.on_states ?? [];
		const next = current.includes(state)
			? current.filter((s) => s !== state)
			: [...current, state];
		setGroup(index, 'on_states', next);
	}

	function addExclude(index: number, entityId: string) {
		if (!sel.groups || !entityId) return;
		const group = sel.groups[index];
		const current = group.exclude ?? [];
		if (!current.includes(entityId)) {
			setGroup(index, 'exclude', [...current, entityId]);
		}
	}

	function removeExclude(index: number, entityId: string) {
		if (!sel.groups) return;
		const group = sel.groups[index];
		setGroup(index, 'exclude', (group.exclude ?? []).filter((id) => id !== entityId));
	}

	function getExcludeOptions(group: PowerSummaryGroup) {
		const domains = group.domains ?? [];
		return Object.keys($states)
			.filter((id) => {
				const domain = id.split('.')[0];
				return domains.includes(domain);
			})
			.sort()
			.map((id) => ({
				id,
				label: $states[id]?.attributes?.friendly_name ?? id,
				hint: id
			}));
	}

	function handleDndConsider(event: CustomEvent) {
		sel.groups = event.detail.items.filter(
			(item: any) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]
		);
		sel.groups = sel.groups;
	}

	function handleDndFinalize(event: CustomEvent) {
		sel.groups = event.detail.items.filter(
			(item: any) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]
		);
		sel.groups = sel.groups;
		save();
	}

	onDestroy(() => $record());
</script>

{#if isOpen}
	<Modal>
		<h1 slot="title">{$lang('power_summary')}</h1>

		<h2>{$lang('preview')}</h2>
		<div class="preview">
			<PowerSummary {sel} />
		</div>

		<h2>{$lang('options')}</h2>

		{#if sel.groups && sel.groups.length > 0}
			<div
				class="group-list"
				use:dndzone={{ items: sel.groups, flipDurationMs: 200, dropTargetStyle: {} }}
				on:consider={handleDndConsider}
				on:finalize={handleDndFinalize}
			>
				{#each sel.groups as group, i (group.id)}
					<div class="group-item" animate:flip={{ duration: 200 }}>
						<button
							class="group-header"
							class:expanded={expandedIndex === i}
							on:click={() => (expandedIndex = expandedIndex === i ? null : i)}
							use:Ripple={$ripple}
						>
							<span class="drag-handle">⠿</span>
							{#if group.icon}
								<Icon icon={group.icon} height="1em" width="1em" />
							{/if}
							<span class="group-name">{group.label || $lang('power_summary')}</span>
							<button
								class="remove-btn"
								on:click|stopPropagation={() => removeGroup(i)}
								aria-label="Remove group"
							>
								<Icon icon="mdi:close" height="1em" width="1em" />
							</button>
						</button>

						{#if expandedIndex === i}
							<div class="group-editor">
								<h2>{$lang('name')}</h2>
								<InputClear
									condition={group.label}
									on:clear={() => setGroup(i, 'label', '')}
									let:padding
								>
									<input
										class="input"
										type="text"
										value={group.label ?? ''}
										placeholder={$lang('power_summary')}
										on:change={(e) => setGroup(i, 'label', (e.target as HTMLInputElement).value)}
										style:padding
										autocomplete="off"
										spellcheck="false"
									/>
								</InputClear>

								<h2>{$lang('icon')}</h2>
								<InputClear
									condition={group.icon}
									on:clear={() => setGroup(i, 'icon', '')}
									let:padding
								>
									<input
										class="input"
										type="text"
										value={group.icon ?? ''}
										placeholder="mdi:lightbulb"
										on:change={(e) => setGroup(i, 'icon', (e.target as HTMLInputElement).value)}
										style:padding
										autocomplete="off"
										spellcheck="false"
									/>
								</InputClear>

								<h2>{$lang('domains')}</h2>
								<div class="chips">
									{#each DOMAINS as domain}
										<button
											class="chip"
											class:selected={(group.domains ?? []).includes(domain)}
											on:click={() => toggleDomain(i, domain)}
											use:Ripple={$ripple}
										>
											{domain}
										</button>
									{/each}
								</div>

								<h2>{$lang('on_states')}</h2>
								<div class="chips">
									{#each ON_STATES as state}
										<button
											class="chip"
											class:selected={(group.on_states ?? []).includes(state)}
											on:click={() => toggleOnState(i, state)}
											use:Ripple={$ripple}
										>
											{state}
										</button>
									{/each}
								</div>

								<h2>{$lang('exclude')}</h2>
								{#if (group.domains ?? []).length > 0}
									<Select
										options={getExcludeOptions(group)}
										placeholder={$lang('exclude')}
										value={undefined}
										on:change={(e) => addExclude(i, e.detail)}
									/>
									{#if (group.exclude ?? []).length > 0}
										<div class="exclude-tags">
											{#each group.exclude ?? [] as entityId}
												<span class="tag">
													{$states[entityId]?.attributes?.friendly_name ?? entityId}
													<button
														class="tag-remove"
														on:click={() => removeExclude(i, entityId)}
														aria-label="Remove {entityId}"
													>
														<Icon icon="mdi:close" height="0.8em" width="0.8em" />
													</button>
												</span>
											{/each}
										</div>
									{/if}
								{:else}
									<p class="hint">Select domains first</p>
								{/if}

								<h2>{$lang('count_suffix')}</h2>
								<InputClear
									condition={group.count_suffix}
									on:clear={() => removeGroupProp(i, 'count_suffix')}
									let:padding
								>
									<input
										class="input"
										type="text"
										value={group.count_suffix ?? ''}
										placeholder="accesi"
										on:change={(e) =>
											setGroup(i, 'count_suffix', (e.target as HTMLInputElement).value || undefined)}
										style:padding
										autocomplete="off"
										spellcheck="false"
									/>
								</InputClear>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<button class="add-group" on:click={addGroup} use:Ripple={$ripple}>
			<Icon icon="mdi:plus" height="1em" width="1em" />
			{$lang('add_group')}
		</button>

		<h2>{$lang('mobile')}</h2>
		<div class="button-container">
			<button
				class:selected={sel?.hide_mobile !== true}
				on:click={() => set('hide_mobile')}
				use:Ripple={$ripple}
			>
				{$lang('visible')}
			</button>
			<button
				class:selected={sel?.hide_mobile === true}
				on:click={() => set('hide_mobile', true)}
				use:Ripple={$ripple}
			>
				{$lang('hidden')}
			</button>
		</div>

		<ConfigButtons {sel} />
	</Modal>
{/if}

<style>
	.preview {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 0.6rem;
		overflow: hidden;
	}

	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		outline: none;
	}

	.group-item {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.6rem;
		overflow: hidden;
	}

	.group-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border: none;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		cursor: pointer;
		text-align: left;
	}

	.group-header.expanded {
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.drag-handle {
		opacity: 0.3;
		cursor: grab;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.group-name {
		flex: 1;
		font-size: 0.9rem;
	}

	.remove-btn {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.2rem;
		opacity: 0.5;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		opacity: 1;
	}

	.group-editor {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		padding: 0.2rem 0.65rem;
		font-size: 0.8rem;
		color: inherit;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}

	.chip.selected {
		background: rgba(255, 255, 255, 0.22);
		border-color: rgba(255, 255, 255, 0.35);
	}

	.exclude-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}

	.tag {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		padding: 0.15rem 0.5rem 0.15rem 0.65rem;
		font-size: 0.8rem;
	}

	.tag-remove {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		opacity: 0.6;
	}

	.tag-remove:hover {
		opacity: 1;
	}

	.add-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px dashed rgba(255, 255, 255, 0.2);
		border-radius: 0.6rem;
		padding: 0.5rem 0.75rem;
		color: inherit;
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		width: 100%;
		margin-top: 0.4rem;
	}

	.add-group:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.hint {
		font-size: 0.8rem;
		opacity: 0.45;
		margin: 0;
	}
</style>
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/Modal/PowerSummaryConfig.svelte
git commit -m "feat(modal): add PowerSummaryConfig modal"
```

---

## Task 6: Register in Type Picker (SidebarItemConfig.svelte)

**Files:**
- Modify: `src/lib/Modal/SidebarItemConfig.svelte`

- [ ] **Step 1: Add import for the display component**

At the top of the `<script>` block, after `import Notifications from '$lib/Sidebar/Notifications.svelte';` (around line 35), add:

```typescript
import PowerSummary from '$lib/Sidebar/PowerSummary.svelte';
```

- [ ] **Step 2: Add entry to `itemTypes` array**

In the `$: itemTypes = [...]` reactive declaration, after the `timer` entry (around line 211), add:

```typescript
{
    id: 'power_summary',
    type: $lang('power_summary'),
    component: PowerSummary,
    props: { demo: true }
},
```

- [ ] **Step 3: Add case to `handleClick` switch**

In the `switch (sel?.type)` block inside `handleClick` (around line 225), after the `template` case and before the `default`, add:

```typescript
case 'power_summary':
    openModal(() => import('$lib/Modal/PowerSummaryConfig.svelte'), { sel });
    break;
```

- [ ] **Step 4: Verify types compile**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 5: Run linter**

```bash
pnpm lint
```

Fix any formatting issues with:
```bash
pnpm format
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/Modal/SidebarItemConfig.svelte
git commit -m "feat(modal): register power_summary in sidebar type picker"
```

---

## Task 7: Visual Verification

**Files:** None — runtime check only.

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Open the dashboard in the browser. Go to edit mode.

- [ ] **Step 2: Add a Power Summary item**

Click the `+` button on the sidebar → verify "Power Summary" appears in the type picker with a demo preview (two groups, one dimmed).

Select it → verify the PowerSummaryConfig modal opens.

- [ ] **Step 3: Configure a group**

Click "Add group" → expand the group → set label "Luci", icon "mdi:lightbulb", domains [light, switch], on_states [on], suffix "accese".

Verify the preview updates in the modal.

- [ ] **Step 4: Check sidebar rendering**

Close the modal → verify the Power Summary appears in the sidebar with the configured group.

If you have HA connected, verify live state: turning on a light should update the count/name in real time.

- [ ] **Step 5: Check zero state**

With all lights off, verify the group row is dimmed (not hidden) in view mode, full opacity in edit mode.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(sidebar): power_summary sidebar component complete"
```
