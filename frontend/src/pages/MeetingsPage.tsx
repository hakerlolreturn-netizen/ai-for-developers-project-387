import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  List,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { components } from '../../../api/dist/schema.d.ts'
import { api } from '../api.ts'
import { inZone } from '../time.ts'

type Meeting = components['schemas']['Meeting']
type Owner = components['schemas']['Owner']

const meetingDay = (meeting: Meeting, timeZone: string) =>
  inZone(meeting.start, timeZone).format('YYYY-MM-DD')
const timeRange = (meeting: Meeting, timeZone: string) =>
  `${inZone(meeting.start, timeZone).format('HH:mm')}–${inZone(meeting.end, timeZone).format('HH:mm')}`

function groupByDay(meetings: Meeting[], timeZone: string) {
  const days = new Map<string, Meeting[]>()
  for (const meeting of meetings) {
    const day = meetingDay(meeting, timeZone)
    days.set(day, [...(days.get(day) ?? []), meeting])
  }
  return [...days]
}

type GuestGroup = { key: string; email: string; names: string[]; meetings: Meeting[] }

function groupByGuest(meetings: Meeting[]): GuestGroup[] {
  const sorted = [...meetings].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const groups = new Map<string, GuestGroup>()
  for (const meeting of sorted) {
    const key = meeting.guestEmail.trim().toLowerCase()
    const group = groups.get(key)
    if (!group) {
      groups.set(key, {
        key,
        email: meeting.guestEmail.trim(),
        names: [meeting.guestName],
        meetings: [meeting],
      })
    } else {
      group.meetings.push(meeting)
      if (!group.names.includes(meeting.guestName)) group.names.push(meeting.guestName)
    }
  }
  return [...groups.values()]
}

const isRunning = (meeting: Meeting, now: number, started: Set<string>) =>
  started.has(meeting.id) || new Date(meeting.start).getTime() <= now

function CancelButton({ meeting, onCancel }: { meeting: Meeting; onCancel: (m: Meeting) => void }) {
  return (
    <Button
      variant="light"
      color="red"
      size="compact-sm"
      aria-label={`Отменить встречу: ${meeting.meetingType.name}, ${meeting.guestName}`}
      onClick={() => onCancel(meeting)}
    >
      Отменить
    </Button>
  )
}

function GuestGroupView({
  group,
  timeZone,
  now,
  started,
  onCancel,
}: {
  group: GuestGroup
  timeZone: string
  now: number
  started: Set<string>
  onCancel: (meeting: Meeting) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [firstName, ...otherNames] = group.names
  return (
    <div>
      <Group gap="xs">
        <Title order={2} size="h4">
          {`${group.email} · ${firstName} · встреч: ${group.meetings.length}`}
        </Title>
        {otherNames.length > 0 && (
          <Button
            variant="subtle"
            size="compact-sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {`+${otherNames.length}`}
          </Button>
        )}
      </Group>
      {expanded && <Text size="sm">{`Другие имена: ${otherNames.join(', ')}`}</Text>}
      <List listStyleType="none" mt="xs" spacing="xs">
        {group.meetings.map((meeting) => (
          <List.Item key={meeting.id}>
            <Group gap="xs">
              <Text>
                {`${dayjs(meetingDay(meeting, timeZone)).locale('ru').format('dddd, D MMMM')} · ${timeRange(meeting, timeZone)} · ${meeting.meetingType.name}`}
              </Text>
              {isRunning(meeting, now, started) ? (
                <Badge color="green">идёт сейчас</Badge>
              ) : (
                <CancelButton meeting={meeting} onCancel={onCancel} />
              )}
            </Group>
          </List.Item>
        ))}
      </List>
    </div>
  )
}

function MeetingsPage() {
  const [mode, setMode] = useState<'days' | 'guests'>('days')
  const [meetings, setMeetings] = useState<Meeting[]>()
  const [owner, setOwner] = useState<Owner>()
  const [now, setNow] = useState(() => Date.now())
  const [started, setStarted] = useState<Set<string>>(() => new Set())
  const [candidate, setCandidate] = useState<Meeting>()
  const [cancelError, setCancelError] = useState<string>()
  const [cancelling, setCancelling] = useState(false)
  const timeZone = owner?.timeZone ?? 'UTC'

  const openCancel = (meeting: Meeting) => {
    setCancelError(undefined)
    setCandidate(meeting)
  }

  const confirmCancel = async () => {
    if (!candidate) return
    setCancelling(true)
    setCancelError(undefined)
    try {
      const { error } = await api.DELETE('/api/meetings/{id}', {
        params: { path: { id: candidate.id } },
      })
      if (error) {
        setCancelError(error.message)
        if (error.code === 'meeting_started') {
          setStarted((current) => new Set(current).add(candidate.id))
          setNow(Date.now())
        }
        return
      }
      setMeetings((current) => current?.filter((meeting) => meeting.id !== candidate.id))
      setCandidate(undefined)
    } catch {
      setCancelError('Не удалось отменить встречу')
    } finally {
      setCancelling(false)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    api.GET('/api/meetings').then(({ data }) => {
      if (active) setMeetings(data)
    })
    api.GET('/api/owner').then(({ data }) => {
      if (active) setOwner(data)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <Container size="sm" py="xl">
      <Title order={1}>Предстоящие встречи · время по Москве</Title>
      {owner && meetings?.length === 0 && <Text mt="md">Предстоящих встреч нет</Text>}
      <Group mt="md" gap="xs">
        <Button
          variant={mode === 'days' ? 'filled' : 'default'}
          aria-pressed={mode === 'days'}
          onClick={() => setMode('days')}
        >
          По дням
        </Button>
        <Button
          variant={mode === 'guests' ? 'filled' : 'default'}
          aria-pressed={mode === 'guests'}
          onClick={() => setMode('guests')}
        >
          По гостям
        </Button>
      </Group>
      <Stack mt="md" gap="lg">
        {mode === 'guests' &&
          groupByGuest(owner ? (meetings ?? []) : []).map((group) => (
            <GuestGroupView
              key={group.key}
              group={group}
              timeZone={timeZone}
              now={now}
              started={started}
              onCancel={openCancel}
            />
          ))}
        {mode === 'days' &&
          groupByDay(owner ? (meetings ?? []) : [], timeZone).map(([day, dayMeetings]) => (
            <div key={day}>
              <Title order={2} size="h4">
                {dayjs(day).locale('ru').format('dddd, D MMMM')}
              </Title>
              <List listStyleType="none" mt="xs" spacing="xs">
                {dayMeetings.map((meeting) => (
                  <List.Item key={meeting.id}>
                    <Group gap="xs">
                      <Text>
                        {`${timeRange(meeting, timeZone)} · ${meeting.meetingType.name} · ${meeting.guestName} · ${meeting.guestEmail}`}
                      </Text>
                      {isRunning(meeting, now, started) ? (
                        <Badge color="green">идёт сейчас</Badge>
                      ) : (
                        <CancelButton meeting={meeting} onCancel={openCancel} />
                      )}
                    </Group>
                  </List.Item>
                ))}
              </List>
            </div>
          ))}
      </Stack>
      <Modal
        opened={candidate !== undefined}
        onClose={() => setCandidate(undefined)}
        title="Отменить встречу?"
        transitionProps={{ duration: 0 }}
      >
        {candidate && (
          <Stack gap="xs">
            <Text>{`Тип: ${candidate.meetingType.name}`}</Text>
            <Text>
              {`Время: ${inZone(candidate.start, timeZone).format('D.MM.YYYY')} ${timeRange(candidate, timeZone)}`}
            </Text>
            <Text>{`Гость: ${candidate.guestName}`}</Text>
            <Text>{`Email: ${candidate.guestEmail}`}</Text>
            {cancelError && (
              <Alert color="red" role="alert">
                {cancelError}
              </Alert>
            )}
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setCandidate(undefined)}>
                Не отменять
              </Button>
              <Button color="red" loading={cancelling} onClick={confirmCancel}>
                Да, отменить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      <Anchor component={Link} to="/" mt="md" display="inline-block">
        На главную
      </Anchor>
    </Container>
  )
}

export default MeetingsPage
