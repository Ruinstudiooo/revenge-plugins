export type Preset = 'desktop' | 'web'

export interface Settings {
	enabled: boolean
	preset: Preset
}

export const DefaultSettings: Settings = {
	enabled: true,
	preset: 'desktop',
}

/**
 * what the gateway reads to decide which platform a session is on.
 * `$browser` is the one that actually matters, `$device` is what makes
 * a phone look like a phone, so desktop keeps it empty.
 */
export const Profiles: Record<Preset, Record<string, string>> = {
	desktop: {
		$os: 'Windows',
		$os_version: '10.0.19045',
		$browser: 'Discord Client',
		$browser_version: '',
		$device: '',
		$release_channel: 'stable',
		$system_locale: 'en-US',
	},
	web: {
		$os: 'Windows',
		$os_version: '10.0.19045',
		$browser: 'Chrome',
		$browser_version: '131.0.0.0',
		$device: '',
		$release_channel: 'stable',
		$system_locale: 'en-US',
	},
}

export let storage: Partial<Settings> | undefined

export function bindStorage(next: Partial<Settings>) {
	storage = next
}

export function readSettings(): Settings {
	return { ...DefaultSettings, ...(storage ?? {}) }
}

export function writeSettings(patch: Partial<Settings>) {
	if (!storage) return
	for (const key in patch) {
		(storage as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key]
	}
}
