import { unlink, access } from 'fs/promises';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request }) => {
	const { name } = await request.json();

	if (!name || name === 'default') {
		error(400, 'Cannot delete the default profile');
	}

	const filepath = `./data/dashboard-${name}.yaml`;

	try {
		await access(filepath);
	} catch {
		error(404, `Profile "${name}" not found`);
	}

	await unlink(filepath);
	return json({});
};
