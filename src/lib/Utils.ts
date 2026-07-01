import type { HassEntity } from 'home-assistant-js-websocket';
import type { Dashboard, Section } from '$lib/Types';
import { get } from 'svelte/store';
import { openModal, closeModal } from 'svelte-modals';
import { callService } from 'home-assistant-js-websocket';
import {
	calendarFirstDay,
	calendarView,
	selectedLanguage,
	connection,
	states,
	lang
} from '$lib/Stores';

/**
 * Converts a ha-fusion locale code (e.g. 'it') to a BCP 47 speech tag
 * required by SpeechRecognition and SpeechSynthesis (e.g. 'it-IT').
 */
export function toSpeechLang(locale: string | undefined): string {
	if (!locale) return 'en-US';
	const overrides: Record<string, string> = {
		en: 'en-US',
		zh: 'zh-CN',
		'zh-Hans': 'zh-CN',
		'zh-Hant': 'zh-TW',
		'es-419': 'es-MX',
		nb: 'nb-NO',
		nn: 'nn-NO',
		gsw: 'de-CH',
		'sr-Latn': 'sr-Latn-RS'
	};
	if (overrides[locale]) return overrides[locale];
	if (locale.includes('-')) return locale;
	return `${locale}-${locale.toUpperCase()}`;
}

export function getAllEntityIds(dashboard: Dashboard): string[] {
	const ids = new Set<string>();

	function collectFromSection(section: Section) {
		section.items?.forEach((item) => {
			if (item.entity_id) ids.add(item.entity_id);
		});
		section.sections?.forEach(collectFromSection);
	}

	dashboard.views?.forEach((view) => view.sections?.forEach(collectFromSection));
	dashboard.sidebar?.forEach((item) => {
		if (item.entity_id) ids.add(item.entity_id);
	});

	return [...ids];
}

/**
 * Updates a selected object's property based on the event or direct value.
 * If no value is provided, the specified property is deleted from the object.
 */
export function updateObj(sel: any, key: string, event?: any) {
	if (event?.type) {
		// select or input
		sel[key] = event.detail || event.target?.value;
	} else if (event !== undefined) {
		// direct value
		sel[key] = event;
	} else {
		delete sel[key];
	}
	return sel;
}

/**
 * Retrieves a selected item by its ID from the given dashboard data.
 * It first searches within the sidebar, then the views sections
 */
export function getSelected(id: number | undefined, data: Dashboard) {
	if (data.sidebar) {
		const sidebarItem = data.sidebar.find((item) => item.id === id);
		if (sidebarItem) return sidebarItem;
	}

	if (data.views) {
		for (const view of data.views) {
			if (view.sections) {
				const result = findInSections(view.sections, id);
				if (result) return result;
			}
		}
	}

	return undefined;
}

function findInSections(sections: Section[], id: number | undefined): any {
	for (const section of sections) {
		if (section.items) {
			for (const item of section.items) {
				if (item.id === id) return item;
			}
		}
		if (
			(section.type === 'horizontal-stack' || section.type === 'vertical-stack') &&
			section.sections
		) {
			const result = findInSections(section.sections, id);
			if (result) return result;
		}
	}
	return undefined;
}

/**
 * Returns the domain from a given entity_id
 * @example domain("light.bedroom") // "light"
 */
export function getDomain(entity_id: string | undefined) {
	return entity_id?.split('.')?.[0];
}

/**
 * Returns the name of a given entity
 * name | friendly_name | entity_id
 */
export function getName(
	sel: any | undefined,
	entity: HassEntity | undefined,
	sectionName: string | undefined = undefined
) {
	const name = sel?.name || entity?.attributes?.friendly_name || entity?.entity_id?.split('.')?.[1];
	return !sel?.name && sectionName && name?.startsWith(sectionName + ' ')
		? name?.substring(sectionName?.length + 1)
		: name;
}

/**
 * Returns togglable service
 */
export function getTogglableService(entity: HassEntity) {
	const domain = getDomain(entity?.entity_id);
	const state = entity?.state;

	if (!domain || !state) return;

	let service;

	switch (domain) {
		case 'automation':
		case 'button':
		case 'cover':
		case 'fan':
		case 'humidifier':
		case 'input_boolean':
		case 'light':
		case 'media_player':
		case 'script':
		case 'siren':
		case 'switch':
			service = 'toggle';
			break;

		case 'input_button':
			service = 'press';
			break;

		case 'lock':
			service = state === 'locked' ? 'unlock' : 'lock';
			break;

		case 'group':
			service = state === 'off' ? 'turn_on' : 'turn_off';
			return `homeassistant.${service}`;

		case 'remote':
			return 'homeassistant.toggle';

		case 'scene':
			service = 'turn_on';
			break;

		case 'timer':
			service = state === 'active' ? 'cancel' : 'start';
			break;

		case 'vacuum':
			service = state === 'cleaning' ? 'pause' : 'start';
			break;
	}

	if (service) {
		return `${domain}.${service}`;
	}
}

function collectSectionIds(sections: any[], ids: Set<unknown>) {
	for (const section of sections) {
		ids.add(section.id);
		if (section.items) {
			for (const item of section.items) ids.add(item.id);
		}
		if (section.sections) {
			collectSectionIds(section.sections, ids);
		}
	}
}

/**
 * Generates a unique 13-digit random ID
 * that doesn't collide with existing IDs
 */
export function generateId(data: Dashboard) {
	const ids = new Set();

	// add ids
	for (const item of data.sidebar) {
		ids.add(item.id);
	}

	for (const view of data.views) {
		ids.add(view.id);

		if (view.sections) {
			collectSectionIds(view.sections, ids);
		}
	}

	let id;
	while (!id || ids.has(id)) {
		id = Math.floor(Math.random() * 1e13 - 1e12) + 1e12;
	}
	return id;
}

/**
 * Check if given string is a timestamp
 * YYYY-MM-DDTHH:MM:SS
 */
export function isTimestamp(state: string) {
	const format = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
	return format.test(state);
}

/**
 * Converts an ISO formatted timestamp
 * into a relative time string
 */
export function relativeTime(timestamp: string, languageCode: string | undefined) {
	const date = new Date(timestamp);

	if (isNaN(date.getTime())) {
		console.error('Invalid timestamp');
	}

	const formatter = new Intl.RelativeTimeFormat(languageCode, { numeric: 'auto' });

	let index;

	const units: any = [
		['second', 60],
		['minute', 60],
		['hour', 24],
		['day', 30],
		['month', 12],
		['year', Infinity]
	];

	const now = new Date();
	const diff = (date.getTime() - now.getTime()) / 1000;

	let diffUnit = Math.abs(diff);
	for (index = 0; index < units.length; index++) {
		if (diffUnit < units[index][1]) break;
		diffUnit /= units[index][1];
	}

	return formatter.format(Math.round(diffUnit) * (diff < 0 ? -1 : 1), units[index][0]);
}

/**
 * Returns an object of supported features
 */
export function getSupport(
	supported_features: number | undefined,
	features: any
): Record<string, boolean> {
	if (!supported_features) return {};

	return Object.entries(features).reduce((supports: Record<string, boolean>, [key, value]) => {
		if (typeof value === 'number') supports[key] = (supported_features & value) !== 0;
		return supports;
	}, {});
}

/**
 * Runs `action` immediately, or — if `confirm` is true — shows the same
 * ConfirmAlert dialog Button.svelte's own icon-click toggle uses, calling
 * `action` only if the user confirms. `onCancel` lets callers revert any
 * optimistic UI change a two-way-bound control (e.g. Toggle's `checked`)
 * already made by the time the click handler runs.
 */
export function confirmableAction(
	confirm: boolean | undefined,
	title: string,
	action: () => void,
	onCancel?: () => void
) {
	if (confirm) {
		openModal(() => import('$lib/Modal/ConfirmAlert.svelte'), {
			title,
			message: get(lang)('confirm_action'),
			confirm: () => {
				closeModal();
				action();
			},
			cancel: () => {
				closeModal();
				onCancel?.();
			}
		});
	} else {
		action();
	}
}

/**
 * Opens the detail modal appropriate for an entity's domain.
 * `sel` is the tile-shaped object passed as a modal prop; defaults to
 * `{ entity_id }` when called without a configured tile (e.g. from the
 * command palette).
 */
export async function openEntityModal(entity_id: string, sel?: any): Promise<void> {
	sel = sel ?? { entity_id };

	switch (getDomain(entity_id)) {
		// light
		case 'light':
			openModal(() => import('$lib/Modal/LightModal.svelte'), {
				sel: sel
			});
			break;

		// switch
		case 'input_boolean':
		case 'remote':
		case 'siren':
		case 'switch':
			openModal(() => import('$lib/Modal/SwitchModal.svelte'), { sel });
			break;

		// script
		case 'script':
			openModal(() => import('$lib/Modal/ScriptModal.svelte'), { sel });
			break;

		// automation
		case 'automation':
			openModal(() => import('$lib/Modal/AutomationModal.svelte'), { sel });
			break;

		// calendar
		case 'calendar': {
			// set first day of week
			calendarFirstDay.set(
				'getWeekInfo' in Intl.Locale.prototype
					? (new Intl.Locale(get(selectedLanguage)) as any)?.getWeekInfo().firstDay
					: (await import('weekstart')).getWeekStartByLocale(get(selectedLanguage))
			);

			// set calendar view type
			calendarView.set(localStorage.getItem('calendar'));

			openModal(() => import('$lib/Modal/CalendarModal.svelte'), { sel });
			break;
		}

		// button
		case 'button':
			callService(get(connection), 'button', 'press', {
				entity_id
			});
			break;

		// sensor
		case 'air_quality':
		case 'date':
		case 'time':
		case 'event':
		case 'image_processing':
		case 'mailbox':
		case 'sensor':
		case 'binary_sensor':
		case 'stt':
		case 'weather':
		case 'scene':
		case 'schedule':
		case 'sun':
		case 'person':
		case 'zone':
		case 'input_button':
			openModal(() => import('$lib/Modal/SensorModal.svelte'), { sel });
			break;

		// update
		case 'update':
			openModal(() => import('$lib/Modal/UpdateModal.svelte'), { sel });
			break;

		// number
		case 'input_number':
		case 'number':
			openModal(() => import('$lib/Modal/InputNumberModal.svelte'), { sel });
			break;

		// date
		case 'input_datetime':
		case 'datetime':
			openModal(() => import('$lib/Modal/InputDateModal.svelte'), { sel });
			break;

		// select
		case 'input_select':
		case 'select':
			openModal(() => import('$lib/Modal/InputSelectModal.svelte'), { sel });
			break;

		// text
		case 'input_text':
		case 'text':
			openModal(() => import('$lib/Modal/InputTextModal.svelte'), { sel });
			break;

		case 'timer':
			openModal(() => import('$lib/Modal/TimerModal.svelte'), { sel });
			break;

		case 'vacuum':
			openModal(() => import('$lib/Modal/VacuumModal.svelte'), { sel });
			break;

		case 'lawn_mower':
			openModal(() => import('$lib/Modal/LawnMowerModal.svelte'), { sel });
			break;

		case 'valve':
			openModal(() => import('$lib/Modal/ValveModal.svelte'), { sel });
			break;

		case 'image':
			openModal(() => import('$lib/Modal/ImageModal.svelte'), { sel });
			break;

		case 'todo':
			openModal(() => import('$lib/Modal/TodoModal.svelte'), { sel });
			break;

		case 'counter':
			openModal(() => import('$lib/Modal/CounterModal.svelte'), { sel });
			break;

		case 'alarm_control_panel':
			openModal(() => import('$lib/Modal/AlarmControlPanelModal.svelte'), { sel });
			break;

		case 'lock':
			openModal(() => import('$lib/Modal/LockModal.svelte'), { sel });
			break;

		case 'climate':
			openModal(() => import('$lib/Modal/ClimateModal.svelte'), { sel });
			break;

		case 'camera':
			openModal(() => import('$lib/Modal/CameraModal.svelte'), { sel });
			break;

		case 'water_heater':
			openModal(() => import('$lib/Modal/WaterHeaterModal.svelte'), { sel });
			break;

		case 'humidifier':
			openModal(() => import('$lib/Modal/HumidifierModal.svelte'), { sel });
			break;

		case 'media_player':
			openModal(() => import('$lib/Modal/MediaPlayer.svelte'), {
				sel
			});
			break;

		case 'group':
			openModal(() => import('$lib/Modal/GroupModal.svelte'), { sel });
			break;

		case 'device_tracker': {
			if (get(states)?.[entity_id]?.attributes?.source_type === 'gps') {
				openModal(() => import('$lib/Modal/DeviceTrackerModal.svelte'), { sel });
			} else {
				openModal(() => import('$lib/Modal/SensorModal.svelte'), { sel });
			}
			break;
		}

		case 'cover':
			openModal(() => import('$lib/Modal/CoverModal.svelte'), {
				selected: sel
			});
			break;

		case 'fan':
			openModal(() => import('$lib/Modal/FanModal.svelte'), {
				selected: sel
			});
			break;

		default:
			openModal(() => import('$lib/Modal/Unknown.svelte'), {
				selected: sel
			});
			break;
	}
}
