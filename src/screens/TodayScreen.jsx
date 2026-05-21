import AppShell from '../components/AppShell'
import todayHtml from '../fragments/today.html?raw'

function TodayScreen() {
  return <AppShell activeRoute="today" html={todayHtml} />
}

export default TodayScreen
