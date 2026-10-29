import type { Decorator } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

export const withMemoryRouter: Decorator = (Story, context) => {
  const initialEntries = (context.parameters.router?.initialEntries as string[] | undefined) ?? [
    '/app',
  ]
  const outlet = context.parameters.router?.outlet as boolean | undefined

  return (
    <MemoryRouter initialEntries={initialEntries}>
      {outlet ? (
        <Routes>
          <Route path="*" element={<Story />} />
        </Routes>
      ) : (
        <Story />
      )}
    </MemoryRouter>
  )
}
