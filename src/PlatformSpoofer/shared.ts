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
 * `$browser` is the one that actually matters, `$device` is the field that
 * makes a phone look like a phone, so desktop keeps it empty.
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

export function store(): Record<string, any> {
	return (vendetta.plugin.storage ??= {})
}

export function readSettings(): Settings {
	return { ...DefaultSettings, ...store() }
}

export function writeSettings(patch: Partial<Settings>) {
	Object.assign(store(), patch)
}

export function readProfile(): Record<string, string> | undefined {
	const { enabled, preset } = readSettings()
	if (!enabled) return undefined
	return Profiles[preset] ?? Profiles.desktop
}
