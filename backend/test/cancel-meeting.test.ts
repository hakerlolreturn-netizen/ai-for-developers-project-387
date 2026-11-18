import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'

describe('DELETE /api/meetings/:id', () => {
  let app: ReturnType<typeof buildApp>
  let now: Date

  afterEach(() => app.close())

  const setup = async () => {
    now = new Date('2026-11-02T10:00:00+03:00')
    app = buildApp({ now: () => now })
    await app.inject({
      method: 'POST',
      url: '/api/meeting-types',
      payload: { id: 'intro', name: 'intro', durationMinutes: 30 },
    })
  }

  const book = async (start: string) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        meetingTypeId: 'intro',
        start,
        guestName: 'Гость',
        guestEmail: 'guest@example.com',
      },
    })
    expect(response.statusCode).toBe(201)
    return response.json().id as string
  }

  const cancel = (id: string) => app.inject({ method: 'DELETE', url: `/api/meetings/${id}` })
  const listIds = async () =>
    (await app.inject({ method: 'GET', url: '/api/meetings' }))
      .json()
      .map((meeting: { id: string }) => meeting.id)

  it('cancels a future meeting and frees its slot', async () => {
    await setup()
    const start = '2026-11-03T09:00:00+03:00'
    const id = await book(start)
    const response = await cancel(id)
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expect(await listIds()).toEqual([])
    const slots = (
      await app.inject({ method: 'GET', url: '/api/meeting-types/intro/slots' })
    ).json()
    expect(slots.map((slot: { start: string }) => Date.parse(slot.start))).toContain(
      Date.parse(start),
    )
    await book(start)
  })

  it('returns 404 for an unknown id and for a repeated cancel', async () => {
    await setup()
    const unknown = await cancel('nope')
    expect(unknown.statusCode).toBe(404)
    expect(unknown.json().code).toBe('meeting_not_found')
    const id = await book('2026-11-03T09:00:00+03:00')
    await cancel(id)
    expect((await cancel(id)).statusCode).toBe(404)
  })

  it('returns 409 for a meeting in progress and for one that has ended', async () => {
    await setup()
    const start = '2026-11-03T09:00:00+03:00'
    const id = await book(start)
    now = new Date('2026-11-03T09:10:00+03:00')
    const inProgress = await cancel(id)
    expect(inProgress.statusCode).toBe(409)
    expect(inProgress.json().code).toBe('meeting_started')
    now = new Date('2026-11-03T10:00:00+03:00')
    expect((await cancel(id)).statusCode).toBe(409)
    now = new Date('2026-11-03T08:00:00+03:00')
    expect(await listIds()).toEqual([id])
  })
})
