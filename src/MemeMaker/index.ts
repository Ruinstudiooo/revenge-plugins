import SettingsScreen from './settings'
import { bindChange, readSettings } from './shared'
import { customUrl, lastImageUrl, memeUrl, readOptions } from './meme'

// ApplicationCommandOptionType.STRING. the enum is not exported to plugins.
const Str = 3

let disposers: (() => void)[] = []

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
			const opts = readOptions(args)
			return { content: memeUrl(opts.template ?? '', opts.top ?? '', opts.bottom ?? '') }
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
			const opts = readOptions(args)
			const text = (opts.text ?? '').trim()
			if (!text) return { content: 'give me something to write first' }

			const background = opts.image?.trim() || lastImageUrl(ctx?.channel?.id)
			if (!background) {
				return { content: 'no image in this channel yet. post one, or pass image: with a link.' }
			}

			return { content: customUrl(background, opts.top ?? '', text) }
		},
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
	if (!vendetta?.commands?.registerCommand) {
		console.log('[meme-maker] no commands api on this build')
		return
	}

	if (settings.meme) disposers.push(vendetta.commands.registerCommand(memeCommand()))
	if (settings.memetext) disposers.push(vendetta.commands.registerCommand(memeTextCommand()))
}

export default {
	onLoad() {
		bindChange(sync)
		sync()
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
