import { build, context } from 'esbuild'

/**
 * classic revenge evaluates the bundle as `(bunny, definePlugin) => { <code>; return plugin?.default ?? plugin }`,
 * so the output has to end up in a top level `plugin` variable. format iife + globalName does exactly that.
 */
const options = {
	entryPoints: ['src/index.ts'],
	outfile: 'builds/ghost-ping/index.js',
	bundle: true,
	format: 'iife',
	globalName: 'plugin',
	target: ['es2019'],
	legalComments: 'none',
}

if (process.argv.includes('--watch')) {
	const ctx = await context(options)
	await ctx.watch()
	console.log('watching src/')
} else {
	await build(options)
	console.log('built builds/ghost-ping/index.js')
}
