const IdentifyOp = /"op"\s*:\s*2\b/

let announced = false

/**
 * the gateway tells discord what platform it is every time it connects, in op 2.
 * everything else about the session (notifications, read state, typing) rides on
 * the same socket, so rewriting just the properties block leaves the rest alone.
 */
export function rewriteIdentify(
	json: unknown,
	profile: Record<string, string> | undefined,
): string | undefined {
	if (!profile || typeof json !== 'string') return
	// cheap reject before parsing, this runs on every gateway frame we send
	if (!json.includes('"properties"') || !IdentifyOp.test(json)) return

	let payload: any
	try {
		payload = JSON.parse(json)
	} catch {
		return
	}

	if (payload?.op !== 2 || !payload.d?.properties) return

	Object.assign(payload.d.properties, profile)
	return JSON.stringify(payload)
}

export function hookGateway(profile: () => Record<string, string> | undefined) {
	const patcher = bunny?.api?.patcher
	if (!patcher) {
		console.log('[platform-spoofer] no patcher on this build')
		return () => {}
	}

	const disposers: (() => void)[] = []
	const WS = (globalThis as any).WebSocket

	if (WS?.prototype?.send) {
		disposers.push(
			patcher.before('send', WS.prototype, (args: unknown[]) => {
				const next = rewriteIdentify(args[0], profile())
				if (!next) return
				return [next, ...args.slice(1)]
			}),
		)
		if (!announced) {
			announced = true
			console.log('[platform-spoofer] hooked the gateway socket, reconnect to apply')
		}
	} else {
		console.log('[platform-spoofer] no WebSocket.send here, nothing to hook')
	}

	return () => {
		for (const dispose of disposers) dispose()
	}
}
