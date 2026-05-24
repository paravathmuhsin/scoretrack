import { RouterProvider } from 'react-router-dom'
import { AndroidAppDownloadModal } from './components/AndroidAppDownloadModal'
import { DeepLinkHandler } from './components/DeepLinkHandler'
import { router } from './router'

export default function App() {
  return (
    <>
      <DeepLinkHandler />
      <AndroidAppDownloadModal />
      <RouterProvider router={router} />
    </>
  )
}
