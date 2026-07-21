import { readFile } from 'fs/promises';
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import dotenv from 'dotenv';

dotenv.config();

export async function load({ request }): Promise<{
	hassUrl: string;
	locale: string | undefined;
	imageInterval: number;

}> {
	// Load minimal config for HA WebSocket connection
	let configuration: any = {};
	try {
		const data = await readFile('./data/configuration.yaml', 'utf8');
		if (data.trim()) {
			const yaml = await import('js-yaml');
			configuration = yaml.default.load(data) || {};
		}
	} catch {
		// configuration file may not exist yet
	}

	const hassUrl = process.env.HASS_URL || request.headers.get('X-Proxy-Target') || '';
	const locale = configuration?.locale || 'en';
	const imageInterval = parseInt(process.env.SCREEN_INTERVAL || '30', 10);



	return {
		hassUrl,
		locale,
		imageInterval,

	};
}
