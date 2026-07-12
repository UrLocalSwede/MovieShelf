import React from 'react'
import { createRoot } from 'react-dom/client'
import { Controls } from './components/Controls'
import './styles/global.css'
import './styles/controls.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Controls />
  </React.StrictMode>
)
