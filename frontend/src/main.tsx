import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import 'dayjs/locale/ru'

import { createTheme, MantineProvider, type CSSVariablesResolver } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'

// WCAG AA needs 4.5:1. Contrast on white by the WCAG formula: blue.8 5.02 (blue.6 3.56), gray.7 8.18 (gray.6 3.32).
const theme = createTheme({ primaryShade: 8 })

const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: { '--mantine-color-dimmed': theme.colors.gray[7] },
  dark: {},
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
      <DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1 }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
)
