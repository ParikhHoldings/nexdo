import { expect, test } from '@playwright/test'
import {
  autoMapCSVColumns,
  normalizeTask,
  parseCSVContent,
  parseICSContent,
  parseJSONExport,
  parseTodoistTask,
} from '../../lib/importers'

const USER_ID = 'import-test-user'

test('Todoist parser preserves priority, due time, labels, and external ref', () => {
  const task = parseTodoistTask(
    {
      id: 'todoist-1',
      content: 'Ship launch checklist',
      priority: 4,
      labels: ['launch', 'ops'],
      due: { datetime: '2026-05-18T15:30:00Z' },
    },
    USER_ID
  )

  expect(task).toMatchObject({
    user_id: USER_ID,
    title: 'Ship launch checklist',
    priority: 'urgent',
    status: 'todo',
    due_date: '2026-05-18',
    due_time: '15:30',
    tags: ['launch', 'ops'],
    external_ref: 'todoist-1',
  })
})

test('CSV parser handles quoted values and auto-mapped task fields', () => {
  const csv = [
    'Task Name,Due Date,Priority,Status,Labels,Owner,Notes',
    '"Call, customer",2026-05-18,High,Done,"sales,launch",Sam,"Confirm rollout timing"',
  ].join('\n')

  const headers = Object.keys(parseCSVContent(csv)[0])
  const rows = parseCSVContent(csv, autoMapCSVColumns(headers))
  const task = normalizeTask(rows[0], 'csv', USER_ID, 'manual')

  expect(task).toMatchObject({
    user_id: USER_ID,
    title: 'Call, customer',
    due_date: '2026-05-18',
    priority: 'high',
    status: 'done',
    context: 'Confirm rollout timing',
    tags: ['sales', 'launch'],
    people: ['Sam'],
    source: 'manual',
  })
  expect(task.completed_at).toBeTruthy()
})

test('ICS parser handles VTODO metadata, folded text, tags, and due time', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VTODO',
    'UID:ics-1',
    'SUMMARY:Prepare investor update',
    'DESCRIPTION:First line\\nsecond line\\, with comma',
    'STATUS:IN-PROCESS',
    'PRIORITY:1',
    'DUE:20260518T143000Z',
    'CATEGORIES:fundraising,launch',
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\n')

  const [task] = parseICSContent(ics, USER_ID)

  expect(task).toMatchObject({
    user_id: USER_ID,
    title: 'Prepare investor update',
    context: 'First line\nsecond line, with comma',
    status: 'in_progress',
    priority: 'urgent',
    due_date: '2026-05-18',
    due_time: '14:30',
    tags: ['fundraising', 'launch'],
    external_ref: 'ics-1',
  })
})

test('Trello JSON parser maps labels, members, due date, and closed status', () => {
  const tasks = parseJSONExport(
    JSON.stringify({
      labels: [
        { id: 'label-1', name: 'customer' },
        { id: 'label-2', color: 'green' },
      ],
      members: [{ id: 'member-1', fullName: 'Casey Lee' }],
      cards: [
        {
          id: 'card-1',
          name: 'Review customer launch board',
          desc: 'Move cards into launch order.',
          due: '2026-05-19T12:00:00Z',
          closed: false,
          idLabels: ['label-1', 'label-2'],
          idMembers: ['member-1'],
        },
      ],
    }),
    'trello',
    USER_ID
  )

  expect(tasks).toEqual([
    expect.objectContaining({
      user_id: USER_ID,
      title: 'Review customer launch board',
      context: 'Move cards into launch order.',
      due_date: '2026-05-19',
      status: 'todo',
      tags: ['customer', 'green'],
      people: ['Casey Lee'],
      external_ref: 'card-1',
    }),
  ])
})

test('Things-style JSON parser handles completed tasks and tags', () => {
  const tasks = parseJSONExport(
    JSON.stringify([
      {
        uuid: 'thing-1',
        title: 'Archive shipped launch tasks',
        notes: 'Keep the launch board tidy.',
        status: 'completed',
        deadline: '2026-05-20',
        tags: ['ops', 'launch'],
      },
    ]),
    'things3',
    USER_ID
  )

  expect(tasks).toEqual([
    expect.objectContaining({
      user_id: USER_ID,
      title: 'Archive shipped launch tasks',
      context: 'Keep the launch board tidy.',
      status: 'done',
      due_date: '2026-05-20',
      tags: ['ops', 'launch'],
      external_ref: 'thing-1',
    }),
  ])
})

test('JSON parser fails closed on invalid exports', () => {
  expect(parseJSONExport('{not json', 'generic', USER_ID)).toEqual([])
})
