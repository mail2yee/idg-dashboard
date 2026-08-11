import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry as AgGridModuleRegistry, AllCommunityModule as AgGridAllCommunityModule } from 'ag-grid-community'
import { ModuleRegistry as AgChartsModuleRegistry, AllCommunityModule as AgChartsAllCommunityModule } from 'ag-charts-community'
import './index.css'
import App from './App.tsx'

AgGridModuleRegistry.registerModules([AgGridAllCommunityModule])
AgChartsModuleRegistry.registerModules([AgChartsAllCommunityModule])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
