import { readFile, readdir, access } from 'fs/promises';
import { dev } from '$app/environment';
import { redirect, error } from '@sveltejs/kit';
import yaml from 'js-yaml';
import type { Configuration, Dashboard, ProfileConfig, Translations } from '$lib/Types';
import dotenv from 'dotenv';

dotenv.config();

async function loadFile(file: string) {
	try {
		const data = await readFile(file, 'utf8');
		if (!data.trim()) return {};
		return file.endsWith('.yaml') ? yaml.load(data) : JSON.parse(data);
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
			console.error(`Error reading or parsing ${file}:`, err);
		}
		return {};
	}
}

async function discoverProfiles(configuration: Configuration): Promise<ProfileConfig[]> {
	let files: string[] = [];
	try {
		files = await readdir('./data');
	} catch {
		return [{ id: 'default', label: 'Default' }];
	}

	const discovered: ProfileConfig[] = files
		.filter((f) => /^dashboard-.+\.yaml$/.test(f))
		.map((f) => {
			const id = f.replace(/^dashboard-/, '').replace(/\.yaml$/, '');
			const override = (configuration.profiles ?? []).find((p) => p.id === id);
			return { id, label: override?.label ?? id };
		});

	const configOrder = configuration.profiles ?? [];
	if (configOrder.length > 0) {
		discovered.sort((a, b) => {
			const ai = configOrder.findIndex((p) => p.id === a.id);
			const bi = configOrder.findIndex((p) => p.id === b.id);
			if (ai === -1) return 1;
			if (bi === -1) return -1;
			return ai - bi;
		});
	}

	return [{ id: 'default', label: 'Default' }, ...discovered];
}

export async function load({ params, request, cookies }): Promise<{
	configuration: Configuration;
	dashboard: Dashboard;
	theme: any;
	translations: Translations;
	profiles: ProfileConfig[];
	currentProfile: string;
}> {
	const profileParam = params.profile as string | undefined;

	// Cookie redirect when no profile in URL
	if (!profileParam) {
		const cookieProfile = cookies.get('ha-fusion-profile');
		if (cookieProfile && cookieProfile !== 'default') {
			try {
				await access(`./data/dashboard-${cookieProfile}.yaml`);
				redirect(302, `/${cookieProfile}`);
			} catch (e: any) {
				if (e.status) throw e;
				// file gone — clear stale cookie and continue with default
				cookies.delete('ha-fusion-profile', { path: '/' });
			}
		}
	}

	// Resolve dashboard file path
	let dashboardFile = './data/dashboard.yaml';
	if (profileParam) {
		dashboardFile = `./data/dashboard-${profileParam}.yaml`;
		try {
			await access(dashboardFile);
		} catch {
			error(404, `Profile "${profileParam}" not found`);
		}
		cookies.set('ha-fusion-profile', profileParam, {
			path: '/',
			maxAge: 31536000,
			sameSite: 'lax',
			httpOnly: false
		});
	}

	// must be loaded first
	const [configuration, dashboard] = await Promise.all([
		loadFile('./data/configuration.yaml'),
		loadFile(dashboardFile)
	]);

	// hassUrl from env or server.js
	configuration.hassUrl = process.env.HASS_URL || request.headers.get('X-Proxy-Target');

	// initialize keys if missing
	dashboard.views = dashboard.views || [];
	dashboard.sidebar = dashboard.sidebar || [];

	const dir = dev ? './static' : './build/client';

	const [theme, en, locale, profiles] = await Promise.all([
		loadFile(`${dir}/themes/${dashboard.theme || 'godis'}.yaml`),
		loadFile(`${dir}/translations/en.json`),
		configuration?.locale && configuration.locale !== 'en'
			? loadFile(`${dir}/translations/${configuration.locale}.json`)
			: undefined,
		discoverProfiles(configuration)
	]);

	return {
		configuration,
		dashboard,
		theme,
		translations: locale ? { ...locale, _default: en } : en,
		profiles,
		currentProfile: profileParam ?? 'default'
	};
}
