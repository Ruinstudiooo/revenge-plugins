import { readSettings, writeSettings } from './shared'
import type { Settings } from './shared'

export default function SettingsScreen() {
	const React = vendetta.metro.common.React
	const RN = vendetta.metro.common.ReactNative
	const [state, setState] = React.useState(() => readSettings() as Settings)

	const update = (patch: Partial<Settings>) => {
		writeSettings(patch)
		setState({ ...state, ...patch })
	}

	const row = (key: 'meme' | 'memetext', label: string, sub: string) =>
		React.createElement(
			RN.View,
			{ key, style: styles.row },
			React.createElement(
				RN.View,
				{ style: styles.texts },
				React.createElement(RN.Text, { style: styles.label }, label),
				React.createElement(RN.Text, { style: styles.sub }, sub),
			),
			React.createElement(RN.Switch, {
				value: Boolean(state[key]),
				onValueChange: (value: boolean) => update({ [key]: value } as Partial<Settings>),
			}),
		)

	return React.createElement(
		RN.ScrollView,
		{ style: styles.screen, contentContainerStyle: styles.content },
		row('meme', '/meme', 'any template, top and bottom text, or a random one'),
		row('memetext', '/memetext', 'writes on the last picture posted in the channel'),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'images are rendered by memegen.link, so both commands need internet. the result arrives as a link, discord turns it into the picture.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'turning one off removes it from the slash picker right away. if it stays visible, close and reopen the picker.',
		),
	)
}

const styles = {
	screen: { flex: 1 },
	content: { padding: 16, gap: 4 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		paddingVertical: 12,
	},
	texts: { flex: 1, gap: 2 },
	label: { color: '#f2f3f5', fontSize: 16, fontWeight: '500' },
	sub: { color: '#a3a6aa', fontSize: 13 },
	note: { color: '#7f8489', fontSize: 12, marginTop: 12, lineHeight: 17 },
} as const
