import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { onFluxEventDispatched, Stores } from '@revenge-mod/discord/flux'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import SettingsComponent from './settings'
import { DefaultSettings } from './shared'
import type { DiscordModules } from '@revenge-mod/discord/types'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { Settings } from './shared'

let storage: JsonStorage<Settings>

interface MessageRecord {
	id: string
	channel_id: string
	content?: string
	author: { id: string; username?: string; globalName?: string; bot?: boolean }
	mentions?: { id: string }[]
	mention_roles?: string[]
	mention_everyone?: boolean
	timestamp?: string
}

interface DeletePayload {
	id: string
	channelId: string
	guildId?: string
}

// The store usually still holds the message while the delete event runs, but not
// always, so the last few hundred records sit in here as a fallback.
const recent = new Map<string, MessageRecord>()
const MaxRecent = 200

const MessageStore = () =>
	Stores.MessageStore as DiscordModules.Flux.Store<{
		getMessage(channelId: string, messageId: string): MessageRecord | undefined
	}>

const AuthenticationStore = () =>
	Stores.AuthenticationStore as DiscordModules.Flux.Store<{ getId(): string }>

function remember(message: MessageRecord) {
	if (!message?.id || !message.author) return

	recent.set(message.id, message)
	if (recent.size <= MaxRecent) return

	const oldest = recent.keys().next().value
	if (oldest) recent.delete(oldest)
}

function pingedUs(record: MessageRecord, settings: Settings, myId: string) {
	if (record.mentions?.some(user => user.id === myId)) return true
	if (settings.everyone && record.mention_everyone) return true
	return false
}

function tooOld(record: MessageRecord, maxAge: number) {
	if (!maxAge || !record.timestamp) return false

	const sent = Date.parse(record.timestamp)
	if (!Number.isFinite(sent)) return false

	return Date.now() - sent > maxAge * 60_000
}

function preview(record: MessageRecord) {
	const text = (record.content ?? '').replace(/\s+/g, ' ').trim()
	if (!text) return 'attachment only'
	return text.length > 70 ? `${text.slice(0, 70)}...` : text
}

function authorOf(record: MessageRecord) {
	return record.author.globalName ?? record.author.username ?? 'someone'
}

function toast(record: MessageRecord) {
	const icon =
		lookupGeneratedIconComponent('BellIcon') ??
		lookupGeneratedIconComponent('NotificationSettingsIcon')

	ToastActionCreators.open(`GHOST_PING_${record.id}`, {
		icon,
		text: `ghost ping from ${authorOf(record)}: ${preview(record)}`,
	})
}

function onDelete(payload: DeletePayload) {
	const settings = { ...DefaultSettings, ...(storage.cache ?? {}) }
	if (!settings.enabled || !payload?.id) return payload

	const record =
		MessageStore().getMessage(payload.channelId, payload.id) ??
		recent.get(payload.id)
	recent.delete(payload.id)

	if (!record) return payload

	const myId = AuthenticationStore().getId()
	if (record.author?.id === myId) return payload
	if (settings.ignoreBots && record.author?.bot) return payload
	if (tooOld(record, settings.maxAge)) return payload
	if (!pingedUs(record, settings, myId)) return payload

	toast(record)
	return payload
}

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: DefaultSettings,
	},
	start({ cleanup, jsonStorage }) {
		storage = jsonStorage

		cleanup(
			onFluxEventDispatched('MESSAGE_CREATE', payload => {
				const message =
					(payload as { message?: MessageRecord }).message ??
					(payload as unknown as MessageRecord)
				if (message?.author) remember(message)
				return payload
			}),
			onFluxEventDispatched('MESSAGE_DELETE', onDelete),
		)
	},
	SettingsComponent,
})
