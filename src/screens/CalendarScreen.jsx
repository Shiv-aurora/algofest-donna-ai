import AppShell from '../components/AppShell'
import calendarHtml from '../fragments/calendar.html?raw'

function CalendarScreen() {
  return <AppShell activeRoute="calendar" html={calendarHtml} />
}

export default CalendarScreen
