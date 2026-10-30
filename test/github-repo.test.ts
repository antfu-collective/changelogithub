import { beforeEach, expect, it, vi } from 'vitest'

const { x } = vi.hoisted(() => ({
  x: vi.fn(),
}))

vi.mock('tinyexec', () => ({ x }))

beforeEach(() => {
  x.mockReset()
})

it('resolves origin through git remote get-url so insteadOf rewrites apply', async () => {
  x.mockResolvedValue({
    stdout: 'https://github.com/0xar-ds/public.git\n',
  })

  const { getGitHubRepo } = await import('../src/git')
  await expect(getGitHubRepo('github.com')).resolves.toBe('0xar-ds/public')

  expect(x).toHaveBeenCalledWith('git', ['remote', 'get-url', 'origin'])
  expect(x).not.toHaveBeenCalledWith('git', ['config', '--get', 'remote.origin.url'])
})

it('still accepts ssh-style remotes from get-url', async () => {
  x.mockResolvedValue({
    stdout: 'git@github.com:antfu-collective/changelogithub.git\n',
  })

  const { getGitHubRepo } = await import('../src/git')
  await expect(getGitHubRepo('github.com')).resolves.toBe('antfu-collective/changelogithub')
})
