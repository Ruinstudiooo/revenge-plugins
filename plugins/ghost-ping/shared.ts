export interface Settings {
	enabled: boolean
	/** also shout when the deleted message mentioned @everyone or @here */
	everyone: boolean
	/** skip deletes of messages older than this, in minutes. 0 keeps every one */
	maxAge: number
	ignoreBots: boolean
}

export const DefaultSettings: Settings = {
	enabled: true,
	everyone: true,
	maxAge: 15,
	ignoreBots: true,
}
