import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Shot } from '../types'

const shots = atom({ plugin: 'read-preview', key: 'shots' } as const, {} as Record<string, Shot>)

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i
const DIR = '/tmp/read-preview'
const MAX_COLUMNS = 60
const MAX_ROWS = 14

// A terminal cell is about twice as tall as wide, so a picture of w by h pixels
// fills 2 * rows * w / h columns.
const fit = (w: number, h: number) => {
  let rows = MAX_ROWS
  let columns = Math.round((2 * rows * w) / h)

  if (columns > MAX_COLUMNS) {
    columns = MAX_COLUMNS
    rows = Math.round((columns * h) / (2 * w))
  }

  return { columns: Math.max(1, columns), rows: Math.max(1, rows) }
}

// The picture and its name; the elements come from the surface the hook drew for.
type Parts = { Box: any; Image: any; Text: any }

function picture(id: string, shot: Shot, { Box, Image, Text }: Parts) {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text dimColor>{shot.name}</Text>
      <Image key={`read-${id}`} source={{ file: shot.file, format: 'png' }} columns={shot.columns} rows={shot.rows} alt={shot.name} />
    </Box>
  )
}

export const register: Register = on => {
  let count = 0

  // Each read of a picture is converted once and remembered under its tool_use_id,
  // so its thumbnail stays in the transcript where the read happened.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny !== undefined || !IMAGE.test(e.file_path)) {
      return ran
    }

    try {
      count += 1
      const out = `${DIR}/${await $.clock.now()}-${count}.png`
      await $.process.run(['mkdir', '-p', DIR])
      const made = await $.process.run(['magick', `${e.file_path}[0]`, '-auto-orient', '-resize', '800x800>', `png:${out}`], { timeoutMs: 20_000 })

      if (made.exitCode !== 0) {
        return ran
      }

      const size = await $.process.run(['magick', 'identify', '-format', '%w %h', out])
      const [w, h] = size.stdout.trim().split(' ').map(Number)

      if (!w || !h) {
        return ran
      }

      const shot: Shot = { file: out, name: e.file_path.split('/').pop() ?? e.file_path, ...fit(w, h) }
      await update($, shots, all => ({ ...all, [e.tool_use_id]: shot }))
    } catch {
      // A preview that cannot be made is not worth failing the read.
    }

    return ran
  }).catch(($, e, next) => next(e))

  // The transcript folds reads into one line ("Read 1 file"); a group holding a
  // read picture is unfolded so each picture shows where it was read.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded) {
      return next(e)
    }

    const all = await read($, shots)
    const hasPicture = e.props.calls.some(call => call.tool === 'Read' && call.tool_use_id !== undefined && all[call.tool_use_id] !== undefined)

    return next(hasPicture ? { ...e, props: { ...e.props, isExpanded: true } } : e)
  })

  // A read row with a picture: the row's name, then the picture under it.
  on('ui.render', { component: 'ToolUse', props: { tool: 'Read' } }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const shot = (await read($, shots))[e.props.tool_use_id]

    if (shot === undefined) {
      return next(e)
    }

    const { Box, Image, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>Read</Text>
          <Text dimColor>({shot.name})</Text>
        </Text>
        {picture(e.props.tool_use_id, shot, { Box, Image, Text })}
      </Box>
    )
  })

  // A standalone read: the picture under the row the engine draws.
  on('ui.render', { component: 'ToolResult', props: { tool: 'Read' } }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const shot = (await read($, shots))[e.props.tool_use_id]

    if (shot === undefined) {
      return next(e)
    }

    const { Box, Image, Text } = $.ui.resolve(e)

    return picture(e.props.tool_use_id, shot, { Box, Image, Text })
  })
}
