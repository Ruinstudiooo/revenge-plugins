import Page from '@revenge-mod/components/Page'
import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Design } from '@revenge-mod/discord/design'
import { DefaultSettings } from './shared'
import type { PluginSettingsComponent } from '@revenge-mod/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from './shared'

const { Stack, TableRadioGroup, TableRadioRow, TableRowGroup, TableSwitchRow } =
	Design

type SettingComponentProps = ComponentProps<
	PluginSettingsComponent<{ jsonStorage: Settings }>
>

export default function SettingsComponent({
	api: { jsonStorage: storage },
}: SettingComponentProps) {
	const { enabled, everyone, maxAge, ignoreBots } = {
		...DefaultSettings,
		...storage.use(),
	}

	return (
		<Page>
			<Stack spacing={24}>
				<TableRowGroup>
					<TableSwitchRow
						icon={<TableRowAssetIcon name="BellIcon" />}
						label="Ghost ping alerts"
						subLabel="Toast me when a message that pinged me gets deleted."
						value={enabled}
						onValueChange={enabled => storage.set({ enabled })}
					/>
					<TableSwitchRow
						label="@everyone and @here"
						subLabel="Also alert for mass pings, not just my own mentions."
						value={everyone}
						onValueChange={everyone => storage.set({ everyone })}
					/>
					<TableSwitchRow
						label="Ignore bots"
						subLabel="Bots edit and delete their own messages all the time."
						value={ignoreBots}
						onValueChange={ignoreBots => storage.set({ ignoreBots })}
					/>
				</TableRowGroup>
				<TableRadioGroup
					title="How late is still a ghost ping"
					defaultValue={String(maxAge)}
					onChange={(value: string) =>
						storage.set({ maxAge: Number(value) })
					}
				>
					<TableRadioRow label="5 minutes" value="5" />
					<TableRadioRow label="15 minutes" value="15" />
					<TableRadioRow label="1 hour" value="60" />
					<TableRadioRow
						label="Whenever"
						subLabel="Any deleted mention counts, however old."
						value="0"
					/>
				</TableRadioGroup>
			</Stack>
		</Page>
	)
}
