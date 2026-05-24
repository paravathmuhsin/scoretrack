import { RouterProvider } from 'react-router-dom'
import { DeepLinkHandler } from './components/DeepLinkHandler'
import { router } from './router'

export default function App() {
  return (
    <>
      <DeepLinkHandler />
      <RouterProvider router={router} />
    </>
  )
}
