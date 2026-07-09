<script lang="ts">
	import { dashboard, lang, record, ripple, states } from '$lib/Stores';
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
	import { updateObj, generateId } from '$lib/Utils';
	import type { PowerSummaryItem, PowerSummaryGroup, PowerSummaryEntity } from '$lib/Types';

	export let isOpen: boolean;
	export let sel: PowerSummaryItem;

	// Ensure groups array exists and every group has an id for DnD
	if (!sel.groups) sel.groups = [];
	sel.groups = sel.groups.map((g) => (g.id ? g : { ...g, id: generateId($dashboard) }));

	let expandedIndex: number | null = sel.groups.length === 0 ? null : 0;

	const DOMAINS = ['light', 'switch', 'climate', 'media_player', 'sensor', 'input_boolean', 'fan', 'cover'];
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
		(sel.groups[index] as any)[key] = value;
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
			id: generateId($dashboard),
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
		const next = current.includes(state) ? current.filter((s) => s !== state) : [...current, state];
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

	function setEntityLabel(index: number, entityId: string, val: string) {
		if (!sel.groups) return;
		const g = sel.groups[index];
		const labels = { ...(g.entity_labels ?? {}) };
		if (val.trim()) labels[entityId] = val.trim();
		else delete labels[entityId];
		setGroup(index, 'entity_labels', labels);
	}

	function removeExclude(index: number, entityId: string) {
		if (!sel.groups) return;
		const group = sel.groups[index];
		setGroup(
			index,
			'exclude',
			(group.exclude ?? []).filter((id) => id !== entityId)
		);
	}

	function getAllEntityOptions() {
		return Object.entries($states)
			.sort(([, a], [, b]) => {
				const na = a?.attributes?.friendly_name ?? a?.entity_id ?? '';
				const nb = b?.attributes?.friendly_name ?? b?.entity_id ?? '';
				return na.localeCompare(nb);
			})
			.map(([id, entity]) => ({
				id,
				label: entity?.attributes?.friendly_name ?? id,
				hint: id
			}));
	}

	function getEntityOptionsForGroup(index: number) {
		const group = sel.groups?.[index];
		if (!group) return [];
		const existing = new Set(group.entities?.map((e) => e.entity_id) ?? []);
		return getAllEntityOptions().filter((opt) => !existing.has(opt.id));
	}

	function addEntity(index: number, entityId: string) {
		if (!sel.groups || !entityId) return;
		const group = sel.groups[index];
		const current = group.entities ?? [];
		if (!current.some((e) => e.entity_id === entityId)) {
			const newEntities: PowerSummaryEntity[] = [...current, { entity_id: entityId, on_state: 'on' }];
			setGroup(index, 'entities', newEntities);
		}
	}

	function removeEntity(index: number, entityId: string) {
		if (!sel.groups) return;
		const group = sel.groups[index];
		setGroup(
			index,
			'entities',
			(group.entities ?? []).filter((e) => e.entity_id !== entityId)
		);
	}

	function setEntityOnState(index: number, entityId: string, onState: string) {
		if (!sel.groups) return;
		const group = sel.groups[index];
		const updated = (group.entities ?? []).map((e) =>
			e.entity_id === entityId ? { ...e, on_state: onState || 'on' } : e
		);
		setGroup(index, 'entities', updated);
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
		sel.groups = event.detail.items;
	}

	function handleDndFinalize(event: CustomEvent) {
		sel.groups = event.detail.items.filter((item: any) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
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
										bind:value={group.label}
										placeholder={$lang('power_summary')}
										on:change={() => setGroup(i, 'label', group.label)}
										style:padding
										autocomplete="off"
										spellcheck="false"
									/>
								</InputClear>

								<h2>{$lang('icon')}</h2>
								<div class="icon-gallery-container">
									<InputClear
										condition={group.icon}
										on:clear={() => setGroup(i, 'icon', '')}
										let:padding
									>
										<input
											class="input"
											type="text"
											bind:value={group.icon}
											placeholder="mdi:lightbulb"
											on:change={() => setGroup(i, 'icon', group.icon)}
											style:padding
											autocomplete="off"
											spellcheck="false"
										/>
									</InputClear>
									<button
										class="icon-gallery"
										title={$lang('icon')}
										on:click={() => window.open('https://icon-sets.iconify.design/', '_blank')}
										use:Ripple={$ripple}
									>
										<Icon icon="majesticons:open-line" height="none" />
									</button>
								</div>

								<h2>{$lang('domains')}</h2>
								<div class="chips">
									{#each DOMAINS as domain}
										<button
											class="chip"
											class:selected={(group.domains ?? []).includes(domain)}
											on:click={() => toggleDomain(i, domain)}
											use:Ripple={$ripple}
										>
											{$lang(domain) || domain}
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
											{$lang(state) || state}
										</button>
									{/each}
								</div>

<h2>实体列表</h2>
												{#if (group.domains ?? []).length > 0}
													{@const domainEntities = Object.keys($states ?? {}).filter(id => (group.domains ?? []).includes(id.split(".")[0])).sort((a,b) => (($states[a]?.attributes?.friendly_name ?? a).localeCompare($states[b]?.attributes?.friendly_name ?? b)))}
													{#if domainEntities.length > 0}
														<div class="entity-list">
														{#each domainEntities as entityId (entityId)}
															{@const excluded = (group.exclude ?? []).includes(entityId)}
															<span class="tag" class:excluded>
																<input class="input tag-name" value={group.entity_labels?.[entityId] || $states[entityId]?.attributes?.friendly_name || entityId} on:input={(e) => setEntityLabel(i, entityId, e.currentTarget.value)} placeholder={$states[entityId]?.attributes?.friendly_name ?? entityId} spellcheck="false" />
																<button class="tag-remove" on:click={() => excluded ? removeExclude(i, entityId) : addExclude(i, entityId)} aria-label={excluded ? "Restore" : "Exclude"}>
																	<Icon icon={excluded ? "mdi:plus-circle" : "mdi:close"} height="0.8em" width="0.8em" />
																</button>
															</span>
														{/each}
														</div>
													{:else}
														<p class="hint">{$lang("nothing_found")}</p>
													{/if}
												{:else}
													<p class="hint">{$lang("select_domains_first")}</p>
												{/if}<h2>{$lang('entities')}</h2>
								<Select
									options={getEntityOptionsForGroup(i)}
									placeholder="{$lang('add')} {$lang('entity')}"
									value={undefined}
									on:change={(e) => addEntity(i, e.detail)}
								/>
								{#if (group.entities ?? []).length > 0}
									<div class="entity-tags">
										{#each group.entities ?? [] as entry}
											<div class="entity-tag">
												<div class="entity-tag-body">
													<span class="entity-name">
														{$states[entry.entity_id]?.attributes?.friendly_name ?? entry.entity_id}
													</span>
													<InputClear
														condition={entry.on_state}
														on:clear={() => setEntityOnState(i, entry.entity_id, 'on')}
														let:padding
													>
														<input
															class="on-state-input"
															type="text"
															value={entry.on_state ?? 'on'}
															placeholder="on"
															on:change={(e) => setEntityOnState(i, entry.entity_id, e.currentTarget.value)}
															style:padding
															autocomplete="off"
															spellcheck="false"
														/>
													</InputClear>
												</div>
												<button
													class="entity-remove"
													on:click={() => removeEntity(i, entry.entity_id)}
													aria-label="Remove entity"
												>
													<Icon icon="mdi:close" height="0.8em" width="0.8em" />
												</button>
											</div>
										{/each}
									</div>
									<p class="hint">{$lang('entities')}: {$lang('priority_over_domains')}</p>
								{/if}
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

	.tag-name-input{background:0 0;border:none;border-bottom:1px dashed rgba(255,255,255,.2);color:inherit;font-size:.75rem;padding:0;max-width:8rem;outline:none}.tag-name-input:focus{border-bottom-color:rgba(255,255,255,.5)}.excluded{opacity:.35;text-decoration:line-through}.entity-list{display:flex;flex-wrap:wrap;gap:.3rem}.exclude-tags {
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

	.icon-gallery-container :global(.clear) {
		flex: 1;
	}

	.entity-tags {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}

	.entity-tag {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.5rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
	}

	.entity-tag-body {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.entity-name {
		flex-shrink: 0;
		max-width: 60%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.on-state-input {
		flex: 1;
		min-width: 40px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0.35rem;
		padding: 0.15rem 0.4rem;
		color: inherit;
		font-family: inherit;
		font-size: 0.78rem;
	}

	.entity-remove {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0.1rem;
		opacity: 0.5;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.entity-remove:hover {
		opacity: 1;
	}
</style>
