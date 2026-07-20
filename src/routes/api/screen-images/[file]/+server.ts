import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	bmp: 'image/bmp',
	svg: 'image/svg+xml',
	avif: 'image/avif'
};

// GET /api/screen-images/[file] — serve an image file
export const GET: RequestHandler = async ({ params }) => {
	const imageDir = process.env.SCREEN_IMAGE_DIR || './data/screen-images';
	const fileName = params.file;

	if (!fileName || fileName.includes('..')) {
		error(400, 'Invalid file name');
	}

	const filePath = path.resolve(imageDir, fileName);

	// Ensure the resolved path stays within the image directory
	if (!filePath.startsWith(path.resolve(imageDir))) {
		error(403, 'Forbidden');
	}

	if (!existsSync(filePath)) {
		error(404, 'Image not found');
	}

	const ext = path.extname(fileName).toLowerCase().replace('.', '');
	const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

	try {
		const data = await readFile(filePath);
		return new Response(data, {
			headers: {
				'Content-Type': mimeType,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err: any) {
		error(500, `Failed to read image: ${err.message}`);
	}
};
