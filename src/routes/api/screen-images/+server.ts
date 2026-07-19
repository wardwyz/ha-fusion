import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import path from 'path';

// GET /api/screen-images — list image files from configured directory
export const GET: RequestHandler = async () => {
	const imageDir = process.env.SCREEN_IMAGE_DIR || './data/screen-images';
	const extensions = (process.env.SCREEN_IMAGE_EXTENSIONS || 'jpg,jpeg,png,webp')
		.split(',')
		.map((ext) => ext.trim().toLowerCase());

	if (!existsSync(imageDir)) {
		return json({ images: [], dir: imageDir });
	}

	try {
		const files = await readdir(imageDir);
		const images = files
			.filter((file) => {
				const ext = path.extname(file).toLowerCase().replace('.', '');
				return extensions.includes(ext);
			})
			.sort(() => Math.random() - 0.5); // shuffle

		return json({ images, dir: imageDir });
	} catch (err: any) {
		error(500, `Failed to read image directory: ${err.message}`);
	}
};
