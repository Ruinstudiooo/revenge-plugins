import SettingsScreen from './settings'
import { bindChange, readSettings } from './shared'
import { customUrl, lastImageUrl, memeUrl, readOptions } from './meme'

// ApplicationCommandOptionType.STRING. the enum is not exported to plugins.
const Str = 3

let disposers: (() => void)[] = []
let announced = false

function toast(message: string) {
	try {
		vendetta.ui.toasts.showToast(message)
	} catch {
		// toast api missing on some builds, console still has it
	}
	console.log(`[meme-maker] ${message}`)
}

/** something went wrong that the user should see, not just the log */
function fail(where: string, error: any) {
	const text = error?.message ?? String(error)
	console.error(`[meme-maker] ${where}`, error)
	toast(`meme maker ${where}: ${text}`.slice(0, 180))
}

/** a command that throws inside execute takes the whole message with it, so catch here */
function guarded(run: () => { content: string }) {
	try {
		return run()
	} catch (error: any) {
		console.error('[meme-maker] execute failed', error)
		return { content: `meme maker broke: ${error?.message ?? error}` }
	}
}

function memeCommand() {
	return {
		name: 'meme',
		description: 'make a meme',
		options: [
			{
				name: 'template',
				description: 'template id like drake or stonks, blank picks a random one',
				type: Str,
				required: false,
			},
			{ name: 'top', description: 'top line', type: Str, required: false },
			{ name: 'bottom', description: 'bottom line', type: Str, required: false },
		],
		execute(args: any[]) {
			return guarded(() => {
				const opts = readOptions(args)
				return { content: memeUrl(opts.template ?? '', opts.top ?? '', opts.bottom ?? '') }
			})
		},
	}
}

function memeTextCommand() {
	return {
		name: 'memetext',
		description: 'put text on the last image posted in this channel',
		options: [
			{ name: 'text', description: 'what the picture should say', type: Str, required: true },
			{ name: 'top', description: 'separate line above it', type: Str, required: false },
			{ name: 'image', description: 'image url, if not the last one in the channel', type: Str, required: false },
		],
		execute(args: any[], ctx: any) {
			return guarded(() => {
				const opts = readOptions(args)
				const text = (opts.text ?? '').trim()
				if (!text) return { content: 'give me something to write first' }

				const channel = ctx?.channel?.id ?? ctx?.channelId ?? ctx?.channel?.channelId
				const background = opts.image?.trim() || lastImageUrl(channel)
				if (!background) {
					return { content: 'no image in this channel yet. post one, or pass image: with a link.' }
				}

				return { content: customUrl(background, opts.top ?? '', text) }
			})
		},
	}
}

function register(command: any) {
	try {
		const dispose = vendetta.commands.registerCommand(command)
		disposers.push(typeof dispose === 'function' ? dispose : () => {})
		return true
	} catch (error) {
		fail(`could not add /${command.name}`, error)
		return false
	}
}

/**
 * registering twice would duplicate the entry in the picker, so every sync
 * unregisters what the last one added. toggles in the settings screen land here.
 */
function sync() {
	for (const dispose of disposers) {
		try {
			dispose()
		} catch {
			// already gone, fine
		}
	}
	disposers = []

	const settings = readSettings()

	if (typeof vendetta?.commands?.registerCommand !== 'function') {
		toast('meme maker: this revenge build has no slash command api')
		return
	}

	const wanted: string[] = []
	if (settings.meme && register(memeCommand())) wanted.push('/meme')
	if (settings.memetext && register(memeTextCommand())) wanted.push('/memetext')

	// one line on start so its obvious whether the plugin actually loaded
	if (!announced && wanted.length) {
		announced = true
		toast(`meme maker ready: ${wanted.join(' ')}`)
	}
}

export default {
	onLoad() {
		try {
			bindChange(sync)
			sync()
		} catch (error) {
			fail('failed to load', error)
		}
	},
	onUnload() {
		for (const dispose of disposers) {
			try {
				dispose()
			} catch {
				// same
			}
		}
		disposers = []
		bindChange(() => {})
	},
	settings: SettingsScreen,
}
