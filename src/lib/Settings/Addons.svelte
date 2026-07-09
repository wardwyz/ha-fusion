<script lang="ts">
	import { lang, youtubeAddon } from '$lib/Stores';
	import { openModal } from 'svelte-modals';
	import Toggle from '$lib/Components/Toggle.svelte';
	import Icon from '@iconify/svelte';
	import { loginMA } from '$lib/MusicAssistant';

	export let data: any;

	function handleFocus(event: FocusEvent) {
		const target = event.target as HTMLInputElement;
		target.type = event.type === 'focus' ? 'text' : 'password';
	}

	const href = 'https://github.com/amedello/ha-fusion/blob/main/static/documentation/Map.md';

	// MA login state — initialised from saved config
	const savedMA = data?.configuration?.addons?.music_assistant;
	let serverUrl: string = savedMA?.server_url || '';
	let loginUsername: string = savedMA?.username || '';
	let loginPassword = '';
	let maToken: string = savedMA?.token || '';
	let maUsername: string = savedMA?.username || '';
	let connecting = false;
	let loginError = '';

	$: isLoggedIn = !!maToken;

	async function handleConnect() {
		loginError = '';
		connecting = true;
		try {
			const result = await loginMA(serverUrl, loginUsername, loginPassword);
			maToken = result.token;
			maUsername = result.username;
			loginPassword = '';
		} catch (e: unknown) {
			loginError = (e instanceof Error ? e.message : String(e)) || 'Errore di connessione';
		} finally {
			connecting = false;
		}
	}

	function handleDisconnect() {
		maToken = '';
		maUsername = '';
		loginPassword = '';
	}

	// MP test state
	let mpTesting = false;
	let mpTestResult: { ok: boolean; msg: string } | null = null;

	async function testMP() {
		mpTesting = true;
		mpTestResult = null;
		try {
			const formEl = document.querySelector('form#settings') as HTMLFormElement | null;
			const fd = new FormData(formEl ?? undefined);
			const url = (fd.get('mp_server_url') as string)?.trim();
			const token = (fd.get('mp_token') as string)?.trim();
			if (!url || !token) {
				mpTestResult = { ok: false, msg: 'Please enter server URL and token' };
				return;
			}
			const resp = await fetch('/_api/moviepilot/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ server_url: url, token })
			});
			const json = await resp.json();
			mpTestResult = json.success
				? { ok: true, msg: json.count ? `Found ${json.count} records` : 'Connected, but no transfer records yet' }
				: { ok: false, msg: json.error ?? 'Unknown error' };
		} catch (e: any) {
			mpTestResult = { ok: false, msg: e.message ?? 'Test failed' };
		} finally {
			mpTesting = false;
		}
	}
</script>

<h2>{$lang('addons')}</h2>

<p class="overflow">
	{$lang('docs')} -
	<a {href} target="blank">{href}</a>
</p>

<div class="grid">
	<div class="item">
		<h3>MapTiler</h3>
		<input
			class="input"
			type="password"
			name="maptiler"
			placeholder={$lang('token')}
			autocomplete="new-password"
			value={data?.configuration?.addons?.['maptiler']?.apikey || ''}
			on:focus={handleFocus}
			on:blur={handleFocus}
		/>
	</div>

	<div class="item">
		<h3>YouTube</h3>
		<div class="button-toggle-container">
			<button
				on:click={() => {
					openModal(() => import('$lib/Modal/YoutubeModal.svelte'), {});
				}}
				>{$lang('configure')}
			</button>

			<div class="toggle">
				<input type="hidden" bind:value={$youtubeAddon} name="youtube" />
				<Toggle bind:checked={$youtubeAddon} />
			</div>
		</div>
	</div>

	<div class="item ma-item">
		<h3>Music Assistant</h3>

		{#if isLoggedIn}
			<div class="ma-connected">
				<span class="ma-conn-label">
					<figure class="ma-conn-icon">
						<Icon icon="mdi:check-circle-outline" height="none" />
					</figure>
					{$lang('connected_as')} <strong>{maUsername}</strong>
					<span class="ma-conn-url">{serverUrl}</span>
				</span>
				<button type="button" class="btn-action" on:click={handleDisconnect}>
					{$lang('disconnect')}
				</button>
			</div>
		{:else}
			<div class="ma-login">
				<input
					class="input"
					type="url"
					bind:value={serverUrl}
					placeholder="http://192.168.1.10:8095"
					autocomplete="off"
				/>
				<input
					class="input"
					type="text"
					bind:value={loginUsername}
					placeholder={$lang('username') || 'Username'}
					autocomplete="username"
				/>
				<div class="ma-pw-row">
					<input
						class="input"
						type="password"
						bind:value={loginPassword}
						placeholder={$lang('password') || 'Password'}
						autocomplete="current-password"
						on:keydown={(e) => e.key === 'Enter' && !connecting && handleConnect()}
					/>
					<button
						type="button"
						class="btn-action"
						on:click={handleConnect}
						disabled={connecting || !serverUrl || !loginUsername || !loginPassword}
					>
						{#if connecting}
							<figure class="spin-icon">
								<Icon icon="svg-spinners:ring-resize" height="none" />
							</figure>
						{:else}
							{$lang('connect') || 'Connetti'}
						{/if}
					</button>
				</div>
				{#if loginError}
					<p class="ma-error">{loginError}</p>
				{/if}
			</div>
		{/if}

		<!-- hidden inputs for form save -->
		<input type="hidden" name="ma_server_url" value={serverUrl} />
		<input type="hidden" name="ma_token" value={maToken} />
		<input type="hidden" name="ma_username" value={maUsername} />
	</div>

	<!-- MoviePilot -->
	<div class="item ma-item">
		<h3>MoviePilot</h3>
		<div class="ma-login">
			<input
				class="input"
				type="url"
				name="mp_server_url"
				placeholder="http://192.168.1.10:3000"
				autocomplete="off"
				value={data?.configuration?.addons?.movie_pilot?.server_url || ''}
			/>
			<div class="ma-pw-row">
				<input
					class="input"
					type="password"
					name="mp_token"
					placeholder={$lang('token')}
					autocomplete="new-password"
					value={data?.configuration?.addons?.movie_pilot?.token || ''}
					on:focus={handleFocus}
					on:blur={handleFocus}
				/>
				<input
					class="input"
					type="password"
					name="mp_tmdb_apikey"
					placeholder="TMDB API Key"
				on:focus={handleFocus}
				on:blur={handleFocus}
			/>
			<input
				class="input"
				type="url"
				name="mp_tmdb_api_url"
				placeholder="TMDB API URL (mirror)"
				autocomplete="off"
				value={data?.configuration?.addons?.movie_pilot?.tmdb_api_url || 'https://api.themoviedb.org/3'}
			/>
			<input
				class="input"
				type="password"
				name="mp_tmdb_apikey_dup" style="display:none"
					autocomplete="new-password"
					value={data?.configuration?.addons?.movie_pilot?.tmdb_apikey || ''}
					on:focus={handleFocus}
					on:blur={handleFocus}
				/>
				<button
					type="button"
					class="btn-action"
					on:click={testMP}
					disabled={mpTesting}
				>
					{#if mpTesting}
						<figure class="spin-icon">
							<Icon icon="svg-spinners:ring-resize" height="none" />
						</figure>
					{:else}
						{$lang('test_connection') || 'Test'}
					{/if}
				</button>
			</div>
			{#if mpTestResult}
				<p class="ma-error" class:ma-success={mpTestResult.ok}>
					{mpTestResult.msg}
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 50% 50%;
		gap: 0.5rem;
	}

	.toggle {
		flex-shrink: 0;
	}

	.button-toggle-container {
		display: flex;
		align-items: center;
		width: 100%;
		justify-content: space-between;
		gap: 1rem;
	}

	button {
		border-radius: 0.4em;
		border: none;
		color: inherit;
		padding: 0.55em 0.9em;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		background-color: var(--theme-button-background-color-off);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		flex-shrink: 1;
	}

	.input {
		padding: 0.6rem !important;
		font-size: 0.9rem;
		height: auto;
	}

	.item {
		background-color: rgb(255, 255, 255, 0.025);
		padding: 0.8rem 1rem 1rem 1rem;
		border-radius: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	h3 {
		margin-block-start: 0;
		margin-block-end: 0.5rem;
		font-size: 1rem;
		font-weight: 500;
		pointer-events: none;
	}

	.ma-item {
		grid-column: 1 / -1;
	}

	.ma-login {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ma-pw-row {
		display: flex;
		gap: 0.4rem;
	}

	.ma-pw-row .input {
		flex: 1;
		min-width: 0;
	}

	.ma-connected {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.ma-conn-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		flex-wrap: wrap;
	}

	.ma-conn-icon {
		width: 1.1rem;
		flex-shrink: 0;
		margin: 0;
		color: #00dd17;
	}

	.ma-conn-url {
		opacity: 0.5;
		font-size: 0.8rem;
		word-break: break-all;
	}

	.ma-error {
		color: #f92626;
		font-size: 0.8rem;
		margin: 0.2rem 0 0;
		padding: 0;
	}

	.ma-success {
		color: #00dd17;
	}

	.btn-action {
		border-radius: 0.4em;
		border: none;
		color: inherit;
		padding: 0.55em 0.9em;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
		background-color: var(--theme-button-background-color-off);
		white-space: nowrap;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.btn-action:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.spin-icon {
		width: 1.1rem;
		margin: 0;
	}

	p {
		margin-block-end: 0.6rem;
		font-size: 0.9rem;
		opacity: 0.75;
	}

	p:hover {
		cursor: default;
	}

	a {
		color: #fa8f92;
	}
</style>
