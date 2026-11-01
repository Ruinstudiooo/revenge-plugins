import { hookGateway } from './identify'
import SettingsComponent from './settings'
import { bindStorage, Profiles, readSettings } from './shared'
import type { Settings } from './shared'

let dispose: (() => void) | undefined

function profile() {
	const { enabled, preset } = readSettings()
	if (!enabled) return undefined
	return Profiles[preset] ?? Profiles.desktop
}

export default definePlugin({
	start() {
		bindStorage(bunny.plugin.createStorage())
		dispose = hookGateway(profile)
	},
	stop() {
		dispose?.()
		dispose = undefined
	},
	SettingsComponent,
})
