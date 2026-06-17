<script lang="ts">
	import { lang, ripple } from '$lib/Stores';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { openModal } from 'svelte-modals';
	import Ripple from 'svelte-ripple';
	import Icon from '@iconify/svelte';
	import type { ProfileConfig } from '$lib/Types';

	let open = false;

	$: profiles = ($page.data.profiles ?? []) as ProfileConfig[];
	$: currentProfile = ($page.data.currentProfile ?? 'default') as string;
	$: currentLabel = profiles.find((p) => p.id === currentProfile)?.label ?? 'Default';

	function toggle() {
		open = !open;
	}

	function handleClickOutside(event: MouseEvent) {
		if (!open) return;
		const target = event.target as HTMLElement;
		const container = document.querySelector('.profile-dropdown');
		if (container && !container.contains(target)) {
			open = false;
		}
	}

	function navigate(id: string) {
		open = false;
		if (id === 'default') {
			document.cookie = 'ha-fusion-profile=default; path=/; max-age=31536000; samesite=lax';
		}
		// Full page reload ensures a clean WebSocket connection and fresh store state.
		// Profile switching is infrequent so the extra reload time is acceptable.
		window.location.href = id === 'default' ? `${base}/` : `${base}/${id}`;
	}

	function handleAdd() {
		open = false;
		openModal(() => import('$lib/Modal/ProfilesModal.svelte'));
	}

	async function handlePointer() {
		await import('$lib/Modal/ProfilesModal.svelte');
	}

	function handleDelete(id: string, label: string) {
		open = false;
		openModal(() => import('$lib/Modal/ConfirmModal.svelte'), {
			title: $lang('delete') + ' ' + label,
			message: $lang('delete_profile_confirm').replace('{label}', label).replace('{name}', id),
			onConfirm: () => deleteProfile(id)
		});
	}

	async function deleteProfile(id: string) {
		const response = await fetch(`${base}/_api/delete_profile`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: id })
		});

		if (response.ok) {
			if (id === currentProfile) {
				document.cookie = 'ha-fusion-profile=default; path=/; max-age=31536000; samesite=lax';
				window.location.href = `${base}/`;
			} else {
				invalidateAll();
			}
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="profile-dropdown">
	<button
		class="button"
		on:click|stopPropagation={toggle}
		on:pointerenter={handlePointer}
		on:pointerdown={handlePointer}
		use:Ripple={$ripple}
	>
		<figure>
			<Icon icon="solar:layers-bold-duotone" height="none" />
		</figure>

		<span>{currentLabel}</span>

		<span class="chevron" class:rotated={open}>
			<Icon icon="gridicons:chevron-down" height="none" />
		</span>
	</button>

	{#if open}
		<div class="popup dropdown">
			<button class="button dropdown" on:click={handleAdd} use:Ripple={$ripple}>
				<figure>
					<Icon icon="gridicons:add-outline" height="none" />
				</figure>
				{$lang('add')}
			</button>

			<hr />

			{#each profiles as profile (profile.id)}
				<div class="profile-row">
					<button
						class="item"
						class:active={profile.id === currentProfile}
						on:click={() => navigate(profile.id)}
						use:Ripple={$ripple}
					>
						{profile.label}
					</button>

					{#if profile.id !== 'default'}
						<button
							class="remove-icon"
							title={$lang('remove')}
							on:click|stopPropagation={() => handleDelete(profile.id, profile.label)}
							use:Ripple={{ ...$ripple, color: 'rgba(0,0,0,0.35)' }}
						>
							<Icon icon="mingcute:close-fill" height="none" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.profile-dropdown {
		position: relative;
		display: inline-flex;
	}

	.chevron {
		display: inline-flex;
		align-items: center;
		margin-left: 0.25rem;
		font-size: 0.75em;
		transition: transform 150ms ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.popup {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		z-index: 100;
		min-width: 10rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		background-color: var(--theme-modal-background-color-modal);
		backdrop-filter: blur(1rem);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.6rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
		padding: 0.3rem;
	}

	hr {
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		margin: 0.1rem 0.5rem 0.2rem;
	}

	.item {
		flex: 1;
		min-width: 0;
		padding: 0.65rem 0.82rem;
		background: none;
		border: none;
		border-radius: calc(0.4rem - 0.2rem);
		color: inherit;
		font-family: inherit;
		font-size: var(--theme-drawer-font-size);
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: background-color 120ms ease;
	}

	.item:hover {
		background-color: rgba(255, 255, 255, 0.08);
	}

	.item.active {
		background-color: rgba(255, 255, 255, 0.15);
		font-weight: 600;
	}

	.item.active:hover {
		background-color: rgba(255, 255, 255, 0.22);
	}

	.profile-row {
		display: flex;
		align-items: center;
	}

	/* reset margins injected by Drawer.css first-of-type / last-of-type rules */
	.profile-row :global(button) {
		margin: 0 !important;
	}

	.remove-icon {
		flex-shrink: 0;
		width: 1.8rem;
		height: 1.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		border-radius: 0.3rem;
		color: inherit;
		cursor: pointer;
		opacity: 0.35;
		font-size: 0.7rem;
		margin-right: 0.2rem;
		transition: background-color 120ms ease, opacity 120ms ease;
	}

	.remove-icon:hover {
		background-color: #ae2e2e;
		opacity: 1;
	}
</style>
