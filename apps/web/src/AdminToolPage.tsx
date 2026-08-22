import type { ClickerMode } from './clicker/bootstrap';
import { AdminGuard } from './AdminGuard';
import { ClickerWorkspacePage } from './ClickerWorkspacePage';
import { useI18n } from './lib/i18n';

function AdminToolContent({ mode }: { mode: ClickerMode }) {
  const { t, language } = useI18n();
  return <main className={`admin-native-workspace admin-native-workspace-${mode}`}>
    <ClickerWorkspacePage initialMode={mode} showModeTabs={false} language={language} labels={{ clicker: t('admin.clicker'), flexKeychain: t('admin.clickerFlexKeychain'), flexOrganizer: t('admin.clickerFlexOrganizer'), svgLayers: t('admin.clickerSvgLayers'), imageVectorizer: t('admin.clickerImageVectorizer') }} />
  </main>;
}

export function AdminToolPage({ mode }: { mode: ClickerMode }) {
  return <AdminGuard>{() => <AdminToolContent mode={mode} />}</AdminGuard>;
}
