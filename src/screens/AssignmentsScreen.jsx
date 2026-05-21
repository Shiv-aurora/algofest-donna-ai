import AppShell from '../components/AppShell'
import assignmentsHtml from '../fragments/assignments.html?raw'

function AssignmentsScreen() {
  return <AppShell activeRoute="assignments" html={assignmentsHtml} />
}

export default AssignmentsScreen
