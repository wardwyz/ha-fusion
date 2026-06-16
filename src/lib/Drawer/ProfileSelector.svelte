<script lang="ts">
	import { lang, ripple, motion } from '$lib/Stores';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import { openModal } from 'svelte-modals';
	import Ripple from 'svelte-ripple';
	import Icon from '@iconify/svelte';

	let creating = false;
	let newName = '';
	let nameError = '';

	$: profiles = $page.data.profiles ?? [];
	$: currentProfile = $page.data.currentProfile ?? 'default';

	function navigate(id: string) {
		if (id === currentProfile) return;
		goto(id === 'default' ? `${base}/` : `${base}/${id}`);
	}

	function startCreate() {
		creating = true;
		newName = '';
		nameError = '';
	}

	function cancelCreate() {
		creating = false;
		newName = '';
		nameError = '';
	}

	async function confirmCreate() {
		const name = newName.trim();
		if (!name) {
			cancelCreate();
			return;
		}

		const response = await fetch(`${base}/_api/create_profile`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});

		if (response.ok) {
			creating = false;
			newName = '';
			nameError = '';
			goto(`${base}/${name}`);
		} else {
			const data = await response.json();
			nameError = $lang(data.message) || data.message;
		}
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') confirmCreate();
		if (event.key === 'Escape') cancelCreate();
	}

	function handleDeleteChip(id: string, label: string) {
		openModal(
			() => import('$lib/Modal/ConfirmModal.svelte'),
			{
				title: $lang('delete') + ' ' + label,
				message: $lang('delete_profile_confirm')
					.replace('{label}', label)
					.replace('{name}', id),
				onConfirm: () => deleteProfile(id)
			}
		);
	}

	async function deleteProfile(id: string) {
		const response = await fetch(`${base}/_api/delete_profile`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: id })
		});

		if (response.ok) {
			if (id === currentProfile) {
				goto(`${base}/`);
			} else {
				invalidateAll();
			}
		}
	}
</script>

<div class="profile-selector">
	<span class="label">{$lang('profiles')}</span>

	{#each profiles as profile (profile.id)}
		<div class="chip-wrap" class:active={profile.id === currentProfile}>
			<button
				class="chip button"
				on:click={() => navigate(profile.id)}
				use:Ripple={$ripple}
				style:transition="background-color {$motion}ms ease"
			>
				{profile.label}
			</button>
			{#if profile.id !== 'default'}
				<button
					class="chip-delete"
					title={$lang('remove')}
					on:click|stopPropagation={() => handleDeleteChip(profile.id, profile.label)}
					use:Ripple={{ ...$ripple, color: 'rgba(0,0,0,0.35)' }}
				>
					<Icon icon="mingcute:close-fill" height="none" />
				</button>
			{/if}
		</div>
	{/each}

	{#if creating}
		<div class="new-chip">
			<!-- svelte-ignore a11y-autofocus -->
			<input
				autofocus
				class="name-input"
				type="text"
				placeholder={$lang('profile_name')}
				bind:value={newName}
				on:keydown={handleInputKeydown}
				on:blur={cancelCreate}
			/>
			{#if nameError}
				<span class="error">{nameError}</span>
			{/if}
		</div>
	{:else}
		<button
			class="add button"
			title={$lang('add')}
			on:click={startCreate}
			use:Ripple={$ripple}
		>
			<Icon icon="gridicons:add-outline" height="none" />
		</button>
	{/if}
</div>

<style>
	.profile-selector {
		grid-area: profiles;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		padding-top: 0.15rem;
	}

	.label {
		font-size: var(--theme-drawer-font-size);
		opacity: 0.55;
		margin-right: 0.2rem;
		white-space: nowrap;
	}

	.chip-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.chip {
		padding: 0.4rem 0.7rem !important;
		font-size: var(--theme-drawer-font-size);
	}

	.chip-wrap.active .chip {
		background-color: rgba(255, 255, 255, 0.25) !important;
		font-weight: 600;
	}

	.chip-delete {
		position: absolute;
		right: -0.35rem;
		top: -0.35rem;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		background-color: rgba(200, 50, 50, 0.85);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font-size: 0.6rem;
	}

	.add {
		padding: 0.4rem 0.5rem !important;
	}

	.name-input {
		background-color: var(--theme-drawer-button-background-color);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 0.4rem;
		color: inherit;
		font-family: inherit;
		font-size: var(--theme-drawer-font-size);
		padding: 0.4rem 0.7rem;
		outline: none;
		width: 10rem;
	}

	.new-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.error {
		font-size: 0.75rem;
		color: rgb(255, 100, 100);
	}
</style>
