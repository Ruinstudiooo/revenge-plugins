import { hookGateway } from './identify'
import SettingsScreen from './settings'

let dispose: (() => void) | undefined

export default {
	onLoad() {
		dispose = hookGateway()
	},
	onUnload() {
		dispose?.()
		dispose = undefined
	},
	settings: SettingsScreen,
}
