import { writeFile, access } from 'fs/promises';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RESERVED = ['api', 'local', 'default'];
const VALID_NAME = /^[a-z0-9-]+$/;
const EMPTY_PROFILE = 'views: []\nsidebar: []\n';

export const POST: RequestHandler = async ({ request }) => {
	const { name, content } = await request.json();

	if (!name || !VALID_NAME.test(name) || RESERVED.includes(name)) {
		error(400, 'profile_invalid_name');
	}

	const filepath = `./data/dashboard-${name}.yaml`;

	try {
		await access(filepath);
		error(400, 'profile_exists');
	} catch (e: any) {
		if (e.status) throw e;
		// ENOENT — file doesn't exist, which is what we want
	}

	const fileContent = typeof content === 'string' && content.trim() ? content : EMPTY_PROFILE;
	await writeFile(filepath, fileContent);
	return json({ id: name });
};
