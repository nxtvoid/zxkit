import { spawnSync } from 'node:child_process'
import process from 'node:process'
import console from 'node:console'

const zones = ['UTC', 'America/New_York', 'Asia/Tokyo']

for (const tz of zones) {
  console.log(`\n── vitest under TZ=${tz} ──`)
  const result = spawnSync('bunx', ['vitest', 'run'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, TZ: tz },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
