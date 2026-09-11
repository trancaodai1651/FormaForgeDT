import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PageTransition } from './components/Shell';
import { LanguageProvider } from './lib/i18n';
import { AdminToolPage } from './pages/admin';
import { AdminFlexLampPage } from './pages/flex-lamp';
import { ModuleLampStudioPage, ModuleSketchPage } from './pages/module-studio';
import { PriceReaderPage } from './pages/price-reader';
import { Hunyuan3DPage } from './pages/hunyuan-3d';
import { ParamacraftPage } from './pages/paramacraft';
import { TulipCreatorPage } from './pages/tulip-creator';
import { HomeItemPage } from './pages/home-item';
import { StlCutterPage } from './pages/stl-cutter';
import { SplitThreeMfPage } from './pages/split-3mf';
import { MekeyStudioPage } from './pages/mekey-studio';
import { PublicToolsPage } from './pages/public-tools';
import { DownloadsPage } from './pages/downloads';

function PublicAdminTool({ mode }: { mode: Parameters<typeof AdminToolPage>[0]['mode'] }) {
  return <AdminToolPage mode={mode} publicAccess />;
}

function AppFrame() {
  const location = useLocation();
  const isHub = location.pathname === '/' || location.pathname === '/admin' || location.pathname === '/downloads';
  const isWorkspace = !isHub;

  return <div className={`app-shell tahoe-ui ${isWorkspace ? 'app-shell-admin-tool tahoe-workspace public-tool-runtime' : 'public-tools-shell'}`}>
    <PageTransition><Routes>
      <Route path="/" element={<PublicToolsPage />} />
      <Route path="/admin" element={<PublicToolsPage />} />
      <Route path="/downloads" element={<DownloadsPage />} />
      <Route path="/clicker" element={<PublicAdminTool mode="clicker" />} />
      <Route path="/admin/clicker" element={<PublicAdminTool mode="clicker" />} />
      <Route path="/flex-keychain" element={<PublicAdminTool mode="flex-keychain" />} />
      <Route path="/admin/flex-keychain" element={<PublicAdminTool mode="flex-keychain" />} />
      <Route path="/flex-organizer" element={<PublicAdminTool mode="flex-organizer" />} />
      <Route path="/admin/flex-organizer" element={<PublicAdminTool mode="flex-organizer" />} />
      <Route path="/svg-layers" element={<PublicAdminTool mode="svg-layers" />} />
      <Route path="/admin/svg-layers" element={<PublicAdminTool mode="svg-layers" />} />
      <Route path="/multi-color" element={<PublicAdminTool mode="multi-color" />} />
      <Route path="/admin/multi-color" element={<PublicAdminTool mode="multi-color" />} />
      <Route path="/image-vectorizer" element={<PublicAdminTool mode="image-vectorizer" />} />
      <Route path="/admin/image-vectorizer" element={<PublicAdminTool mode="image-vectorizer" />} />
      <Route path="/mekey-studio" element={<MekeyStudioPage />} />
      <Route path="/admin/mekey-studio" element={<MekeyStudioPage />} />
      <Route path="/flex-lamp" element={<AdminFlexLampPage publicAccess />} />
      <Route path="/admin/flex-lamp" element={<AdminFlexLampPage publicAccess />} />
      <Route path="/tulip-creator" element={<TulipCreatorPage />} />
      <Route path="/admin/tulip-creator" element={<TulipCreatorPage />} />
      <Route path="/lamp-body-creator" element={<TulipCreatorPage />} />
      <Route path="/admin/lamp-body-creator" element={<TulipCreatorPage />} />
      <Route path="/home-item" element={<HomeItemPage />} />
      <Route path="/admin/home-item" element={<HomeItemPage />} />
      <Route path="/stl-cutter" element={<StlCutterPage />} />
      <Route path="/admin/stl-cutter" element={<StlCutterPage />} />
      <Route path="/split-3mf" element={<SplitThreeMfPage />} />
      <Route path="/admin/split-3mf" element={<SplitThreeMfPage />} />
      <Route path="/hunyuan-3d" element={<Hunyuan3DPage publicAccess />} />
      <Route path="/admin/hunyuan-3d" element={<Hunyuan3DPage publicAccess />} />
      <Route path="/paramacraft/viewer/:presetId" element={<ParamacraftPage />} />
      <Route path="/paramacraft" element={<ParamacraftPage />} />
      <Route path="/admin/paramacraft" element={<ParamacraftPage />} />
      <Route path="/module-studio" element={<ModuleLampStudioPage />} />
      <Route path="/module-studio/sketch" element={<ModuleSketchPage />} />
      <Route path="/admin/module-studio" element={<ModuleLampStudioPage />} />
      <Route path="/admin/module-studio/sketch" element={<ModuleSketchPage />} />
      <Route path="/admin/cad-studio" element={<ModuleSketchPage />} />
      <Route path="/price-reader" element={<PriceReaderPage />} />
      <Route path="/admin/price-reader" element={<PriceReaderPage />} />
      <Route path="*" element={<PublicToolsPage />} />
    </Routes></PageTransition>
  </div>;
}

export default function App() {
  return <HashRouter><LanguageProvider><AppFrame /></LanguageProvider></HashRouter>;
}
