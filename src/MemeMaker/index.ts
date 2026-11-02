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
	try {
		const picked = vendetta.metro.findByProps?.('getChannelId', 'getLastSelectedChannelId')?.getChannelId?.()
		return ctx?.channel?.id ?? ctx?.channelId ?? ctx?.channel?.channelId ?? picked ?? undefined
	} catch {
		return ctx?.channel?.id ?? ctx?.channelId ?? ctx?.channel?.channelId
	}
}

// flipped on while the command is not posting on someone's build. it makes each
// step visible as a toast so a failure is not silent.
const DEBUG = true

function trace(message: string) {
	if (DEBUG) toast(message)
}

/**
 * discord rejects a half filled message quietly, so send the same shape a real
 * send uses and wait for it before claiming anything went out.
 */
async function deliver(ctx: any, content: string) {
	const channelId = channelOf(ctx)

	if (!channelId) {
		trace('meme maker: no channel in the command context')
		return { content }
	}

	const payload = { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] }

	const senders = [
		() => vendetta.metro.findByProps?.('sendMessage', 'editMessage')?.sendMessage,
		() => vendetta.metro.findByProps?.('sendMessage', 'receiveMessage')?.sendMessage,
	]

	for (const get of senders) {
		try {
			const send = get()
			if (typeof send !== 'function') continue
			await send(channelId, payload)
			trace('meme maker: posted')
			return undefined
		} catch (error) {
			console.error('[meme-maker] sendMessage failed', error)
		}
	}

	// last resort, matches what the built in slash commands use
	try {
		const bot = vendetta.metro.findByProps?.('sendBotMessage')?.sendBotMessage
		if (typeof bot === 'function') {
			await bot(channelId, payload)
			trace('meme maker: posted as bot message')
			return undefined
		}
	} catch (error) {
		console.error('[meme-maker] sendBotMessage failed', error)
	}

	trace('meme maker: could not post, handing the link back to revenge')

	// let revenge do it, this is the path that usually works
	return { content }
}

/** a command that throws inside execute takes the whole message with it, so catch here */
async function guarded(name: string, ctx: any, run: () => string) {
	trace(`meme maker: /${name} ran`)
	try {
		return await deliver(ctx, run())
	} catch (error: any) {
		console.error('[meme-maker] execute failed', error)
		const text = `meme maker broke: ${error?.message ?? error}`
		try {
			return await deliver(ctx, text)
		} catch {
			return { content: text }
		}
	}
}

function memeCommand() {
	return {
		name: 'meme',
		displayName: 'meme',
		description: 'make a meme',
		displayDescription: 'make a meme',
		applicationId: '-1',
		type: 1,
		inputType: 1,
		options: [
			{
				name: 'template',
				displayName: 'template',
				description: 'template id like drake or stonks, blank picks a random one',
				displayDescription: 'template id like drake or stonks, blank picks a random one',
				type: Str,
				required: false,
			},
			{ name: 'top', displayName: 'top', description: 'top line', displayDescription: 'top line', type: Str, required: false },
			{
				name: 'bottom',
				displayName: 'bottom',
				description: 'bottom line',
				displayDescription: 'bottom line',
				type: Str,
				required: false,
			},
		],
		execute(args: any[], ctx: any) {
			return guarded('meme', ctx, () => {
				const opts = readOptions(args)
				return memeUrl(opts.template ?? '', opts.top ?? '', opts.bottom ?? '')
			})
		},
	}
}

function memeTextCommand() {
	return {
		name: 'memetext',
		displayName: 'memetext',
		description: 'put text on the last image posted in this channel',
		displayDescription: 'put text on the last image posted in this channel',
		applicationId: '-1',
		type: 1,
		inputType: 1,
		options: [
			{
				name: 'text',
				displayName: 'text',
				description: 'what the picture should say',
				displayDescription: 'what the picture should say',
				type: Str,
				required: true,
			},
			{ name: 'top', displayName: 'top', description: 'separate line above it', displayDescription: 'separate line above it', type: Str, required: false },
			{
				name: 'image',
				displayName: 'image',
				description: 'image url, if not the last one in the channel',
				displayDescription: 'image url, if not the last one in the channel',
				type: Str,
				required: false,
			},
		],
		execute(args: any[], ctx: any) {
			return guarded('memetext', ctx, () => {
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

		// discord numbers its built in commands downwards from -1, so -60 is a
		// normal id. only NaN means revenge could not work a number out at all
		if (Number.isNaN(Number(command.id))) {
			trace(`meme maker: /${command.name} got a bad id (${command.id})`)
		}

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
