import { handler } from './build/handler.js';
import express from 'express';
import { existsSync } from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

const app = express();

// environment
dotenv.config();
const ADDON = process.env.ADDON === 'true';
const { PORT, HASS_PORT, EXPOSED_PORT } = process.env;

// dynamically set target
const entryMiddleware = async (req, res, next) => {
	// default
	let target = process.env.HASS_URL;

	if (ADDON) {
		// headers
		const {
			'x-hass-source': source,
			'x-forwarded-proto': forwardedProto,
			'x-forwarded-host': forwardedHost,
			host
		} = req.headers;

		// ingress
		if (source && forwardedProto && forwardedHost) {
			target = `${forwardedProto}://${forwardedHost}`;
		}

		// exposed port
		else if (host && EXPOSED_PORT && HASS_PORT) {
			const proto = req.secure ? 'https' : 'http';
			target = `${proto}://${host.replace(EXPOSED_PORT, HASS_PORT)}`;
		}
	}

	// target should be defined now
	if (!target) {
		throw new Error('Proxy target could not be determined');
	}

	// add header for +page.server.ts
	req.headers['X-Proxy-Target'] = target;
	req.target = target;
	next();
};

// production proxy
const proxy = createProxyMiddleware({
	pathFilter: (path) => {
		// proxy HA local/ and api/ paths, but NOT our screen-images endpoint
		if (path.startsWith('/api/screen-images') || path.startsWith('/api/screen-lyrics')) return false;
		return path.startsWith('/local/') || path.startsWith('/api/');
	},
	router: (req) => req.target,
	changeOrigin: true
});

app.use(entryMiddleware, proxy);

// Screen lock: serve static images from configured directory (production)
const screenImageDir = process.env.SCREEN_IMAGE_DIR || './data/screen-images';
if (existsSync(screenImageDir)) {
	app.use('/screen-images', express.static(screenImageDir));
	console.log('Serving screen images from:', screenImageDir);
}

// let SvelteKit handle everything else, including serving prerendered pages and static assets
app.use(handler);

app.listen(PORT, () => {
	if (ADDON) {
		console.log('ADDON:', ADDON);
		console.log('INGRESS_PORT:', PORT);
		console.log('EXPOSED_PORT:', EXPOSED_PORT);
		console.log('HASS_PORT:', HASS_PORT);
	} else {
		console.log('HASS_URL:', process.env.HASS_URL);
		console.log('PORT:', PORT);
		console.log('ADDON:', ADDON);
	}
});
