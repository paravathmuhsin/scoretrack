import { RouterProvider } from 'react-router-dom'
import { AndroidAppDownloadModal } from './components/AndroidAppDownloadModal'
import { DeepLinkHandler } from './components/DeepLinkHandler'
import { StagingBanner } from './components/StagingBanner'
import { router } from './router'

export default function App() {
  return (
    <>
      <StagingBanner />
      <DeepLinkHandler />
      <AndroidAppDownloadModal />
      <RouterProvider router={router} />
    </>
  )
}
