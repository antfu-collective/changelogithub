import type { ChangelogOptions } from '../src/types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publishRelease, sendRelease, uploadAssets } from '../src/github'

vi.mock('ofetch', () => ({ $fetch: vi.fn() }))

const fetchMock = vi.mocked($fetch)

const options = {
  baseUrlApi: 'api.github.com',
  releaseRepo: 'owner/repo',
  to: 'v1.0.0',
  token: 'token',
} as ChangelogOptions

const RELEASE_URL = 'https://api.github.com/repos/owner/repo/releases/1'

function requestBody(call: number) {
  return JSON.parse(fetchMock.mock.calls[call]![1]!.body as string)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendRelease', () => {
  it('creates a new release with assets as a draft, so the assets can be uploaded before it is published', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Not Found'))
      .mockResolvedValueOnce({ url: RELEASE_URL, draft: true })

    await sendRelease(options, 'notes', true)

    expect(fetchMock.mock.calls[1]![1]!.method).toBe('POST')
    expect(requestBody(1).draft).toBe(true)
  })

  it('publishes a new release without assets at once', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Not Found'))
      .mockResolvedValueOnce({ url: RELEASE_URL, draft: false })

    await sendRelease(options, 'notes')

    expect(requestBody(1).draft).toBe(false)
  })

  it('does not turn an existing published release back into a draft', async () => {
    fetchMock
      .mockResolvedValueOnce({ url: RELEASE_URL })
      .mockResolvedValueOnce({ url: RELEASE_URL, draft: false })

    await sendRelease(options, 'notes', true)

    expect(fetchMock.mock.calls[1]![1]!.method).toBe('PATCH')
    expect(requestBody(1).draft).toBe(false)
  })
})

describe('publishRelease', () => {
  it('marks the release as no longer a draft', async () => {
    fetchMock.mockResolvedValueOnce({ html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0' })

    await publishRelease(options, { url: RELEASE_URL })

    expect(fetchMock.mock.calls[0]![0]).toBe(RELEASE_URL)
    expect(fetchMock.mock.calls[0]![1]!.method).toBe('PATCH')
    expect(requestBody(0)).toEqual({ draft: false })
  })
})

describe('uploadAssets', () => {
  it('fails when an asset cannot be uploaded, so the release is not published without it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'changelogithub-'))
    const file = join(dir, 'app.zip')
    await writeFile(file, 'zip')
    fetchMock.mockRejectedValueOnce(new Error('422 Cannot upload assets to an immutable release'))

    await expect(uploadAssets(options, file, { upload_url: 'https://uploads.github.com/upload{?name,label}' }))
      .rejects
      .toThrow('Failed to upload 1 asset(s): app.zip')
    await rm(dir, { recursive: true })
  })
})
