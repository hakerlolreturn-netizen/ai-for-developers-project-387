import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'

type Stub = {
  id: string
  meetingType: { id: string; name: string; durationMinutes: number }
  start: string
  end: string
  guestName: string
  guestEmail: string
}

const meeting = (
  id: string,
  typeName: string,
  start: string,
  end: string,
  guestName: string,
  guestEmail = `${id}@example.com`,
): Stub => ({
  id,
  meetingType: { id: typeName, name: typeName, durationMinutes: 30 },
  start,
  end,
  guestName,
  guestEmail,
})

let meetings: Stub[]
let ownerTimeZone: string
let deleteError: { code: string; message: string } | undefined
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-29T10:15:00+03:00'))
  meetings = []
  deleteError = undefined
  ownerTimeZone = 'Europe/Moscow'
  fetchMock = vi.fn(async (input: Request) => {
    const { pathname } = new URL(input.url)
    if (pathname === '/api/meetings') return Response.json(meetings)
    if (pathname === '/api/owner') {
      return Response.json({ name: 'Владелец календаря', timeZone: ownerTimeZone })
    }
    if (input.method === 'DELETE' && pathname.startsWith('/api/meetings/')) {
      if (deleteError) return Response.json(deleteError, { status: 409 })
      const id = pathname.split('/').pop()
      meetings = meetings.filter((item) => item.id !== id)
      return new Response(null, { status: 204 })
    }
    return Response.json({ code: 'not_found', message: 'Не найдено' }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function renderPage() {
  render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/meetings']}>
        <App />
      </MemoryRouter>
    </MantineProvider>,
  )
}

describe('предстоящие встречи', () => {
  it('показывает заголовок и пустое состояние', async () => {
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Предстоящие встречи · время по Москве' }),
    ).toBeTruthy()
    expect(await screen.findByText('Предстоящих встреч нет')).toBeTruthy()
  })

  it('группирует встречи по дням и показывает строки', async () => {
    meetings = [
      meeting('a', 'Знакомство', '2026-10-29T12:00:00+03:00', '2026-10-29T12:30:00+03:00', 'Анна'),
      meeting('b', 'Разбор', '2026-10-30T09:00:00+03:00', '2026-10-30T10:00:00+03:00', 'Борис'),
    ]
    renderPage()

    expect(await screen.findByRole('heading', { name: 'четверг, 29 октября' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'пятница, 30 октября' })).toBeTruthy()
    expect(screen.getByText('12:00–12:30 · Знакомство · Анна · a@example.com')).toBeTruthy()
    expect(screen.getByText('09:00–10:00 · Разбор · Борис · b@example.com')).toBeTruthy()
    expect(screen.queryByText('идёт сейчас')).toBeNull()
    expect(screen.queryByText('Предстоящих встреч нет')).toBeNull()
  })

  it('показывает время в часовом поясе владельца', async () => {
    ownerTimeZone = 'Asia/Yekaterinburg'
    meetings = [
      meeting('a', 'Знакомство', '2026-10-29T22:00:00+03:00', '2026-10-29T22:30:00+03:00', 'Анна'),
    ]
    renderPage()

    expect(await screen.findByRole('heading', { name: 'пятница, 30 октября' })).toBeTruthy()
    expect(screen.getByText('00:00–00:30 · Знакомство · Анна · a@example.com')).toBeTruthy()
  })

  it('помечает идущую встречу значком', async () => {
    meetings = [
      meeting('a', 'Знакомство', '2026-10-29T10:00:00+03:00', '2026-10-29T10:30:00+03:00', 'Анна'),
      meeting('b', 'Разбор', '2026-10-29T12:00:00+03:00', '2026-10-29T13:00:00+03:00', 'Борис'),
    ]
    renderPage()

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]!).getByText('идёт сейчас')).toBeTruthy()
    expect(within(rows[1]!).queryByText('идёт сейчас')).toBeNull()
  })

  it('загружает данные один раз при открытии', async () => {
    renderPage()
    await screen.findByText('Предстоящих встреч нет')

    const meetingCalls = fetchMock.mock.calls.filter(
      ([input]) => new URL(input.url).pathname === '/api/meetings',
    )
    expect(meetingCalls).toHaveLength(1)
  })

  describe('режим «По гостям»', () => {
    const at = (day: number, hour: number) => ({
      start: `2026-10-${day}T${String(hour).padStart(2, '0')}:00:00+03:00`,
      end: `2026-10-${day}T${String(hour).padStart(2, '0')}:30:00+03:00`,
    })
    const make = (id: string, day: number, hour: number, name: string, email: string) =>
      meeting(id, 'Знакомство', at(day, hour).start, at(day, hour).end, name, email)

    it('по умолчанию «По дням», переключается туда и обратно', async () => {
      meetings = [make('a', 29, 12, 'Анна', 'anna@x.com')]
      renderPage()

      expect(await screen.findByRole('heading', { name: 'четверг, 29 октября' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'По дням' }).getAttribute('aria-pressed')).toBe(
        'true',
      )

      fireEvent.click(screen.getByRole('button', { name: 'По гостям' }))
      expect(screen.getByRole('heading', { name: 'anna@x.com · Анна · встреч: 1' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'четверг, 29 октября' })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'По дням' }))
      expect(screen.getByRole('heading', { name: 'четверг, 29 октября' })).toBeTruthy()
    })

    it('объединяет email в разном регистре и с пробелами, группы по ближайшей встрече', async () => {
      meetings = [
        make('a', 30, 9, 'Борис', 'boris@x.com'),
        make('b', 29, 12, 'Анна', 'Anna@X.com'),
        make('c', 29, 15, 'Анна', ' anna@x.com '),
      ]
      renderPage()
      await screen.findByRole('button', { name: 'По гостям' })
      await screen.findByRole('heading', { name: 'четверг, 29 октября' })
      fireEvent.click(screen.getByRole('button', { name: 'По гостям' }))

      const headings = screen.getAllByRole('heading', { level: 2 })
      expect(headings.map((h) => h.textContent)).toEqual([
        'Anna@X.com · Анна · встреч: 2',
        'boris@x.com · Борис · встреч: 1',
      ])
      const rows = within(screen.getAllByRole('list')[0]!).getAllByRole('listitem')
      expect(rows.map((r) => r.textContent)).toEqual([
        'четверг, 29 октября · 12:00–12:30 · ЗнакомствоОтменить',
        'четверг, 29 октября · 15:00–15:30 · ЗнакомствоОтменить',
      ])
    })

    it('показывает бейдж «идёт сейчас»', async () => {
      meetings = [
        meeting(
          'a',
          'Знакомство',
          '2026-10-29T10:00:00+03:00',
          '2026-10-29T10:30:00+03:00',
          'Анна',
        ),
      ]
      renderPage()
      await screen.findByRole('heading', { name: 'четверг, 29 октября' })
      fireEvent.click(screen.getByRole('button', { name: 'По гостям' }))
      expect(screen.getByText('идёт сейчас')).toBeTruthy()
    })

    it('несколько имён: первое и +N, клик раскрывает и скрывает', async () => {
      meetings = [
        make('a', 29, 12, 'Анна', 'anna@x.com'),
        make('b', 29, 14, 'Аня', 'anna@x.com'),
        make('c', 30, 9, 'Анна', 'anna@x.com'),
        make('d', 30, 10, 'Борис', 'boris@x.com'),
      ]
      renderPage()
      await screen.findByRole('heading', { name: 'четверг, 29 октября' })
      fireEvent.click(screen.getByRole('button', { name: 'По гостям' }))

      expect(screen.getByRole('heading', { name: 'anna@x.com · Анна · встреч: 3' })).toBeTruthy()
      expect(screen.getAllByRole('button', { name: /^\+\d+$/ })).toHaveLength(1)
      const counter = screen.getByRole('button', { name: '+1' })
      expect(screen.queryByText('Другие имена: Аня')).toBeNull()

      fireEvent.click(counter)
      expect(screen.getByText('Другие имена: Аня')).toBeTruthy()
      fireEvent.click(counter)
      expect(screen.queryByText('Другие имена: Аня')).toBeNull()
    })

    it('раскрытие одной группы не влияет на другие', async () => {
      meetings = [
        make('a', 29, 12, 'Анна', 'anna@x.com'),
        make('b', 29, 13, 'Аня', 'anna@x.com'),
        make('c', 29, 14, 'Борис', 'boris@x.com'),
        make('d', 29, 15, 'Боря', 'boris@x.com'),
      ]
      renderPage()
      await screen.findByRole('heading', { name: 'четверг, 29 октября' })
      fireEvent.click(screen.getByRole('button', { name: 'По гостям' }))

      fireEvent.click(screen.getAllByRole('button', { name: '+1' })[0]!)
      expect(screen.getByText('Другие имена: Аня')).toBeTruthy()
      expect(screen.queryByText('Другие имена: Боря')).toBeNull()
    })

    it('пустой список в режиме «По гостям»', async () => {
      renderPage()
      await screen.findByText('Предстоящих встреч нет')
      fireEvent.click(screen.getByRole('button', { name: 'По гостям' }))
      expect(screen.getByText('Предстоящих встреч нет')).toBeTruthy()
    })
  })

  describe('отмена встречи', () => {
    const future = () =>
      meeting('a', 'Знакомство', '2026-10-29T12:00:00+03:00', '2026-10-29T12:30:00+03:00', 'Анна')
    const running = () =>
      meeting('b', 'Разбор', '2026-10-29T10:00:00+03:00', '2026-10-29T10:30:00+03:00', 'Борис')

    it('кнопка есть у будущей встречи и нет у идущей', async () => {
      meetings = [running(), future()]
      renderPage()

      const rows = await screen.findAllByRole('listitem')
      expect(within(rows[0]!).queryByRole('button', { name: /Отменить/ })).toBeNull()
      expect(within(rows[1]!).getByRole('button', { name: /Отменить/ })).toBeTruthy()
    })

    it('показывает подтверждение с данными встречи, отказ ничего не удаляет', async () => {
      meetings = [future()]
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: /Отменить/ }))
      const dialog = await screen.findByRole('dialog', { name: 'Отменить встречу?' })
      expect(within(dialog).getByText('Тип: Знакомство')).toBeTruthy()
      expect(within(dialog).getByText('Время: 29.10.2026 12:00–12:30')).toBeTruthy()
      expect(within(dialog).getByText('Гость: Анна')).toBeTruthy()
      expect(within(dialog).getByText('Email: a@example.com')).toBeTruthy()

      fireEvent.click(within(dialog).getByRole('button', { name: 'Не отменять' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByText(/Знакомство · Анна/)).toBeTruthy()
      expect(fetchMock.mock.calls.some(([input]) => input.method === 'DELETE')).toBe(false)
    })

    it('подтверждение убирает встречу из списка', async () => {
      meetings = [future()]
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: /Отменить/ }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Да, отменить' }))

      expect(await screen.findByText('Предстоящих встреч нет')).toBeTruthy()
      expect(screen.queryByText(/Знакомство · Анна/)).toBeNull()
    })

    it('в режиме «По гостям» группа пропадает с последней встречей', async () => {
      meetings = [future()]
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: 'По гостям' }))
      expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /Отменить встречу: / }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Да, отменить' }))

      expect(await screen.findByText('Предстоящих встреч нет')).toBeTruthy()
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    })

    it('показывает сообщение об ошибке из ответа API', async () => {
      meetings = [future()]
      deleteError = { code: 'meeting_started', message: 'Встреча уже началась, её нельзя отменить' }
      renderPage()

      fireEvent.click(await screen.findByRole('button', { name: /Отменить/ }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Да, отменить' }))

      expect(await screen.findByText('Встреча уже началась, её нельзя отменить')).toBeTruthy()
      expect(screen.getByText(/Знакомство · Анна/)).toBeTruthy()
    })

    describe('время идёт после открытия страницы', () => {
      const running = () =>
        meeting('r', 'Знакомство', '2026-10-29T10:20:00+03:00', '2026-10-29T10:50:00+03:00', 'Анна')

      it.each(['По дням', 'По гостям'])(
        'в режиме «%s» у начавшейся встречи кнопка заменяется бейджем',
        async (label) => {
          meetings = [running()]
          renderPage()

          fireEvent.click(await screen.findByRole('button', { name: label }))
          expect(await screen.findByRole('button', { name: /Отменить встречу: / })).toBeTruthy()
          expect(screen.queryByText('идёт сейчас')).toBeNull()

          vi.setSystemTime(new Date('2026-10-29T10:25:00+03:00'))

          expect(await screen.findByText('идёт сейчас', {}, { timeout: 3000 })).toBeTruthy()
          expect(screen.queryByRole('button', { name: /Отменить встречу: / })).toBeNull()
        },
      )

      it('после 409 meeting_started у встречи нет кнопки, даже если часы страницы отстают', async () => {
        meetings = [running()]
        deleteError = {
          code: 'meeting_started',
          message: 'Встреча уже началась, её нельзя отменить',
        }
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: /Отменить встречу: / }))
        const dialog = await screen.findByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Да, отменить' }))
        expect(await screen.findByText('Встреча уже началась, её нельзя отменить')).toBeTruthy()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Не отменять' }))

        expect(await screen.findByText('идёт сейчас')).toBeTruthy()
        expect(screen.queryByRole('button', { name: /Отменить встречу: / })).toBeNull()
      })
    })
  })
})
