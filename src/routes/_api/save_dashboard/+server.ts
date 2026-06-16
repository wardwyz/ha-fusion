import { writeFile } from 'fs/promises';
import { json, error } from '@sveltejs/kit';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { dashboard, profile } = body;

	const VALID_PROFILE = /^[a-z0-9-]+$/;
	if (profile && profile !== 'default' && !VALID_PROFILE.test(profile)) {
		error(400, 'Invalid profile name');
	}

	const filename =
		!profile || profile === 'default'
			? './data/dashboard.yaml'
			: `./data/dashboard-${profile}.yaml`;

	let data;
	try {
		data = yaml.dump(dashboard);
	} catch (err: any) {
		error(500, err.message);
	}

	if (!data) error(500, 'Failed to serialize dashboard');

	try {
		await writeFile(filename, data);
		return json({ message: 'saved' });
	} catch (err: any) {
		error(500, err.message);
	}
};
