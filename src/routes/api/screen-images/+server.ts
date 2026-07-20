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

	// Recursive directory walk
	const images: string[] = [];
	async function walkDir(dir: string, relativePath: string = '') {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walkDir(fullPath, path.join(relativePath, entry.name));
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase().replace('.', '');
				if (extensions.includes(ext)) {
					images.push(relativePath ? path.join(relativePath, entry.name) : entry.name);
				}
			}
		}
	}

	try {
		await walkDir(imageDir);
		images.sort(() => Math.random() - 0.5); // shuffle

		return json({ images, dir: imageDir });
	} catch (err: any) {
		error(500, `Failed to read image directory: ${err.message}`);
	}
};
