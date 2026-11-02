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

function channelOf(ctx: any): string | undefined {
	return ctx?.channel?.id ?? ctx?.channelId ?? ctx?.channel?.channelId
}

/**
 * revenge normally posts whatever execute returns, but that hook sits behind a
 * patcher and silently does nothing when it misses. posting here first means the
 * command works either way, and we only hand the object back if this path fails.
 */
function deliver(ctx: any, content: string) {
	const channelId = channelOf(ctx)

	if (channelId) {
		const senders = [
			() => vendetta.metro.findByProps?.('sendMessage', 'receiveMessage')?.sendMessage,
			() => vendetta.metro.findByProps?.('sendMessage', 'editMessage')?.sendMessage,
		]

		for (const get of senders) {
			try {
				const send = get()
				if (typeof send !== 'function') continue
				send(channelId, { content })
				return undefined
			} catch (error) {
				console.error('[meme-maker] sendMessage failed', error)
			}
		}

		// last resort, matches what the built in slash commands use
		try {
			const bot = vendetta.metro.findByProps?.('sendBotMessage')?.sendBotMessage
			if (typeof bot === 'function') {
				bot(channelId, { content })
				return undefined
			}
		} catch (error) {
			console.error('[meme-maker] sendBotMessage failed', error)
		}
	}

	// let revenge do it, this is the path that usually works
	return { content }
}

/** a command that throws inside execute takes the whole message with it, so catch here */
function guarded(ctx: any, run: () => string) {
	try {
		return deliver(ctx, run())
	} catch (error: any) {
		console.error('[meme-maker] execute failed', error)
		const text = `meme maker broke: ${error?.message ?? error}`
		try {
			return deliver(ctx, text)
		} catch {
			return { content: text }
		}
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
		execute(args: any[], ctx: any) {
			return guarded(ctx, () => {
				const opts = readOptions(args)
				return memeUrl(opts.template ?? '', opts.top ?? '', opts.bottom ?? '')
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
			return guarded(ctx, () => {
				const opts = readOptions(args)
				const text = (opts.text ?? '').trim()
				if (!text) return 'give me something to write first'

				const background = opts.image?.trim() || lastImageUrl(channelOf(ctx))
				if (!background) {
					return 'no image in this channel yet. post one, or pass image: with a link.'
				}

				return customUrl(background, opts.top ?? '', text)
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
