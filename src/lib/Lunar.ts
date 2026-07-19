// ── Lunar Calendar ──────────────────────────────────────────────────────────
const LUNAR_YEARS: number[] = [
	0x4dbf, 0x4ae0, 0xa570, 0x54d5, 0xd260, 0xd950, 0x5554, 0x56a0, 0x9ad0, 0x55d2,
	0x4ae0, 0xa5b6, 0xa4d0, 0xd250, 0xd295, 0xb540, 0xd6a0, 0xada2, 0x95b0, 0x4977,
	0x4970, 0x64b0, 0xd4a0, 0xea50, 0x6da5, 0x5ac0, 0xab60, 0x9570, 0x4cae, 0xa570,
	0x54d5, 0xd260
];

const BASE_DATE = new Date(2000, 0, 1);
const BASE_LUNAR_YEAR  = 1999;  // 己卯年
const BASE_LUNAR_MONTH = 11;    // 十一月
const BASE_LUNAR_DAY   = 25;    // 廿五

function monthDays(y: number, m: number): number {
	return (LUNAR_YEARS[y - 2000] & (0x10000 >> m)) ? 30 : 29;
}
function leapMonth(y: number): number {
	return LUNAR_YEARS[y - 2000] & 0xf;
}
function leapDays(y: number): number {
	const bits = LUNAR_YEARS[y - 2000];
	if (!(bits & 0xf)) return 0;
	return (bits & 0x10000) ? 30 : 29;
}

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = [
	'初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
	'十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
	'廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
];
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI   = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const SHENG_XIAO = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

export interface LunarDate {
	year: number; yearStr: string; shengXiao: string;
	month: number; monthStr: string;
	day: number; dayStr: string;
	isLeap: boolean;
}

export function solarToLunar(date: Date): LunarDate {
	const offset = Math.floor((date.getTime() - BASE_DATE.getTime()) / 86400000);
	if (offset < 0) {
		return {
			year: date.getFullYear(), yearStr: '', shengXiao: '',
			month: date.getMonth() + 1, monthStr: '', day: date.getDate(), dayStr: '',
			isLeap: false
		};
	}

	let ly = BASE_LUNAR_YEAR;
	let lm = BASE_LUNAR_MONTH;
	let ld = BASE_LUNAR_DAY;
	let isLeap = false;
	let rem = offset;

	// Finish the current lunar month (from day 25 to end)
	const firstMonthLen = monthDays(ly, lm);
	const daysLeft = firstMonthLen - ld;
	if (rem <= daysLeft) {
		ld += rem;
		return formatLunar(ly, lm, ld, false);
	}
	rem -= daysLeft + 1;
	// Advance to next month
	lm++; ld = 1;
	if (lm > 12) { lm = 1; ly++; }

	// Process month by month
	while (rem > 0) {
		const leap = leapMonth(ly);
		let daysThisMonth: number;

		if (isLeap) {
			daysThisMonth = leapDays(ly);
		} else {
			daysThisMonth = monthDays(ly, lm);
		}

		if (rem < daysThisMonth) {
			ld = rem + 1;
			rem = 0;
		} else {
			rem -= daysThisMonth;
			// Next month
			if (!isLeap && leap > 0 && lm === leap) {
				isLeap = true; // stay on same month number, but leap
			} else {
				isLeap = false;
				lm++;
				if (lm > 12) { lm = 1; ly++; }
			}
		}
	}

	return formatLunar(ly, lm, ld, isLeap);
}

function formatLunar(y: number, m: number, d: number, leap: boolean): LunarDate {
	const gz = (y - 4) % 10;
	const z = (y - 4) % 12;
	return {
		year: y,
		yearStr: TIAN_GAN[gz >= 0 ? gz : gz + 10] + DI_ZHI[z >= 0 ? z : z + 12],
		shengXiao: SHENG_XIAO[z >= 0 ? z : z + 12],
		month: m,
		monthStr: MONTH_NAMES[m - 1] || '',
		day: d,
		dayStr: DAY_NAMES[d - 1] || `${d}日`,
		isLeap: leap,
	};
}

// ── Festivals ────────────────────────────────────────────────────────────────

const LUNAR_FESTIVALS: { name: string; m: number; d: number }[] = [
	{ name: '春节',     m: 1,  d: 1  },
	{ name: '元宵节',   m: 1,  d: 15 },
	{ name: '端午节',   m: 5,  d: 5  },
	{ name: '七夕节',   m: 7,  d: 7  },
	{ name: '中元节',   m: 7,  d: 15 },
	{ name: '中秋节',   m: 8,  d: 15 },
	{ name: '重阳节',   m: 9,  d: 9  },
	{ name: '腊八节',   m: 12, d: 8  },
];

const SOLAR_FESTIVALS: Record<string, string> = {
	'1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '3-12': '植树节',
	'4-1': '愚人节', '5-1': '劳动节', '5-4': '青年节', '6-1': '儿童节',
	'7-1': '建党节', '8-1': '建军节', '9-10': '教师节',
	'10-1': '国庆节', '12-24': '平安夜', '12-25': '圣诞节',
};

export function getFestival(lunar: LunarDate, gregorian: Date): string | null {
	const gm = gregorian.getMonth() + 1;
	const gd = gregorian.getDate();

	// Solar festivals
	const sk = `${gm}-${gd}`;
	if (SOLAR_FESTIVALS[sk]) return SOLAR_FESTIVALS[sk];

	// Lunar festivals
	for (const f of LUNAR_FESTIVALS) {
		if (f.m === lunar.month && f.d === lunar.day) return f.name;
	}

	// 除夕: last day of 12th month
	if (lunar.month === 12) {
		const lastDay = monthDays(lunar.year, 12);
		if (lunar.day === lastDay) return '除夕';
	}

	// 清明: ~Apr 4-5
	if (gm === 4 && (gd === 4 || gd === 5)) return '清明节';
	// 冬至: ~Dec 21-23
	if (gm === 12 && gd >= 21 && gd <= 23) return '冬至';

	return null;
}

// ── Weather translation ─────────────────────────────────────────────────────

export const WEATHER_ZH: Record<string, string> = {
	'clear-night': '晴', cloudy: '多云', fog: '雾', hail: '冰雹',
	lightning: '雷暴', 'lightning-rainy': '雷阵雨', partlycloudy: '多云',
	pouring: '大雨', rainy: '雨', snowy: '雪', 'snowy-rainy': '雨夹雪',
	sunny: '晴', windy: '大风', 'windy-variant': '大风', exceptional: '异常',
};
