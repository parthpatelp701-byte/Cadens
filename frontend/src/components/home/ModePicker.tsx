import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Bookmark,
  CheckSquare,
  Focus,
  Send,
  Sparkles, ChevronDown,
  Users,
} from 'lucide-react'

type ToolLink = { label: string; to: string }
type Mode = {
  title: string
  note: string
  to: string
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  tools: ToolLink[]
  featured?: boolean
}

const modes: Mode[] = [
  {
    title: 'plan the day',
    note: 'tasks, checklists and time',
    to: '/tasks',
    icon: CheckSquare,
    featured: true,
    tools: [
      { label: 'tasks', to: '/tasks' },
      { label: 'calendar', to: '/calendar' },
      { label: 'task board + templates', to: '/app.html?mode=focus' },
      { label: 'personal timeboard', to: '/app.html?mode=calendar' },
    ],
  },
  {
    title: 'save something',
    note: 'notes, links, lists and places',
    to: '/saves',
    icon: Bookmark,
    featured: true,
    tools: [
      { label: 'saves', to: '/saves' },
      { label: 'pin this place', to: '/app.html?mode=places' },
      { label: 'shopping lists', to: '/app.html?mode=lists' },
      { label: 'shop links', to: '/app.html?mode=links' },
    ],
  },
  {
    title: 'check in',
    note: 'journal, daily brief and review',
    to: '/journal',
    icon: BookOpen,
    tools: [
      { label: 'journal', to: '/journal' },
      { label: 'daily brief', to: '/app.html?mode=wrap' },
      { label: 'weekly review', to: '/app.html?mode=review' },
    ],
  },
  {
    title: 'move together',
    note: 'spaces, ideas and conversation',
    to: '/people',
    icon: Users,
    tools: [
      { label: 'spaces + ideas', to: '/people' },
      { label: 'messages', to: '/messages' },
      { label: 'share progress', to: '/progress' },
    ],
  },
  {
    title: 'build momentum',
    note: 'focus, habits, streaks and wins',
    to: '/app.html?mode=focus',
    icon: Focus,
    tools: [
      { label: 'focus + habits', to: '/app.html?mode=focus' },
      { label: 'points + leaderboard', to: '/app.html?mode=leaderboard' },
    ],
  },
  {
    title: 'send + sync',
    note: 'share the plan or move your data',
    to: '/app.html?mode=share',
    icon: Send,
    tools: [
      { label: 'share plan', to: '/app.html?mode=share' },
      { label: 'calendar sync', to: '/app.html?mode=sync' },
      { label: 'export data', to: '/you' },
      { label: 'reminders + contacts', to: '/app.html?mode=sync' },
    ],
  },
]

function Destination({
  to,
  className,
  children,
}: {
  to: string
  className: string
  children: ReactNode
}) {
  return to.startsWith('/app.html') ? (
    <a href={to} className={className}>
      {children}
    </a>
  ) : (
    <Link to={to} className={className} viewTransition>
      {children}
    </Link>
  )
}

export function ModePicker() {
  return (
    <section aria-labelledby="mode-picker-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="mode-picker-title" className="text-base font-bold">
          what do you want to do?
        </h2>
        <Sparkles size={18} className="text-[var(--color-acc)]" aria-hidden />
      </div>
      <div className="mode-grid">
        {modes.map(({ title, icon: Icon, tools, featured }) => (
          <details
            key={title}
            className={featured ? 'mode-card mode-card-featured' : 'mode-card'}
          >
            <summary className="mode-card-main">
              <span className="mode-card-icon">
                <Icon size={20} aria-hidden />
              </span>
              <span>
                <strong>{title}</strong>
              </span>
              <ChevronDown size={16} className="mode-chevron" aria-hidden />
            </summary>
            <div className="mode-card-tools" aria-label={`${title} tools`}>
              {tools.map((tool) => (
                <Destination key={tool.to + tool.label} to={tool.to} className="mode-tool">
                  {tool.label}
                </Destination>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
