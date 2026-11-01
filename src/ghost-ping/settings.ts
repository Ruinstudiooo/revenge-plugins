import { readSettings, writeSettings } from './shared'
import type { Settings } from './shared'

const Ages: { value: number; label: string }[] = [
	{ value: 5, label: '5m' },
	{ value: 15, label: '15m' },
	{ value: 60, label: '1h' },
	{ value: 0, label: 'any' },
]

export default function SettingsComponent() {
	const React = bunny.metro.common.React
	const RN = bunny.metro.common.ReactNative
	const [state, setState] = React.useState(() => readSettings() as Settings)

	const update = (patch: Partial<Settings>) => {
		writeSettings(patch)
		setState({ ...state, ...patch })
	}

	const switchRow = (key: 'enabled' | 'everyone' | 'ignoreBots', label: string, sub: string) =>
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

	const ageButton = ({ value, label }: { value: number; label: string }) => {
		const active = state.maxAge === value

		return React.createElement(
			RN.Pressable,
			{
				key: value,
				style: [styles.pill, active && styles.pillActive],
				onPress: () => update({ maxAge: value }),
			},
			React.createElement(
				RN.Text,
				{ style: [styles.pillText, active && styles.pillTextActive] },
				label,
			),
		)
	}

	return React.createElement(
		RN.ScrollView,
		{ style: styles.screen, contentContainerStyle: styles.content },
		switchRow('enabled', 'Ghost ping alerts', 'toast me when a message that pinged me gets deleted'),
		switchRow('everyone', '@everyone and @here', 'also count mass pings, not just my own mentions'),
		switchRow('ignoreBots', 'Ignore bots', 'bots edit and delete their own messages all the time'),
		React.createElement(
			RN.View,
			{ style: styles.row },
			React.createElement(
				RN.View,
				{ style: styles.texts },
				React.createElement(RN.Text, { style: styles.label }, 'How late is still a ghost ping'),
				React.createElement(RN.Text, { style: styles.sub }, 'deletes older than this get ignored'),
			),
			React.createElement(RN.View, { style: styles.pills }, Ages.map(ageButton)),
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
	pills: { flexDirection: 'row', gap: 6 },
	pill: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: '#2b2d31',
	},
	pillActive: { backgroundColor: '#5865f2' },
	pillText: { color: '#b5bac1', fontSize: 13 },
	pillTextActive: { color: '#ffffff', fontWeight: '600' },
} as const
