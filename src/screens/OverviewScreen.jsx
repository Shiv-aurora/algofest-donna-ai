import AppShell from '../components/AppShell'
import overviewHtml from '../fragments/overview.html?raw'

function OverviewScreen() {
  return <AppShell activeRoute="dashboard" html={overviewHtml} />
}

export default OverviewScreen
