import { readSettings, writeSettings } from './shared'
import type { Preset, Settings } from './shared'

const Presets: { value: Preset; label: string }[] = [
	{ value: 'desktop', label: 'Desktop' },
	{ value: 'web', label: 'Browser' },
]

export default function SettingsScreen() {
	const React = vendetta.metro.common.React
	const RN = vendetta.metro.common.ReactNative
	const [state, setState] = React.useState(() => readSettings() as Settings)

	const update = (patch: Partial<Settings>) => {
		writeSettings(patch)
		setState({ ...state, ...patch })
	}

	const presetButton = ({ value, label }: { value: Preset; label: string }) => {
		const active = state.preset === value

		return React.createElement(
			RN.Pressable,
			{
				key: value,
				style: [styles.pill, active && styles.pillActive],
				onPress: () => update({ preset: value }),
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
		React.createElement(
			RN.View,
			{ style: styles.row },
			React.createElement(
				RN.View,
				{ style: styles.texts },
				React.createElement(RN.Text, { style: styles.label }, 'Show me as desktop'),
				React.createElement(
					RN.Text,
					{ style: styles.sub },
					'everyone sees the desktop icon, including people on stock discord',
				),
			),
			React.createElement(RN.Switch, {
				value: state.enabled,
				onValueChange: (enabled: boolean) => update({ enabled }),
			}),
		),
		React.createElement(
			RN.View,
			{ style: styles.row },
			React.createElement(
				RN.View,
				{ style: styles.texts },
				React.createElement(RN.Text, { style: styles.label }, 'Pretend to be'),
				React.createElement(
					RN.Text,
					{ style: styles.sub },
					'desktop app or a browser tab, both look the same to other people',
				),
			),
			React.createElement(RN.View, { style: styles.pills }, Presets.map(presetButton)),
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'restart discord after flipping this. the phone only says which platform it is when the gateway connects, so the change lands on the next connect.',
		),
		React.createElement(
			RN.Text,
			{ style: styles.note },
			'notifications keep working, they go through push, not the gateway.',
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
