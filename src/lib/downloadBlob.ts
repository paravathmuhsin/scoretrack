import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function isShareCancelled(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /cancel/i.test(msg)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
}

function downloadViaAnchor(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Saves a blob as a file. On native, opens the share sheet (Drive, Print, etc.). */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadViaAnchor(blob, fileName)
    return
  }

  const base64 = await blobToBase64(blob)
  const { uri } = await Filesystem.writeFile({
    path: `exports/${fileName}`,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  })

  try {
    await Share.share({
      title: fileName,
      files: [uri],
      dialogTitle: 'Save PDF',
    })
  } catch (err) {
    if (isShareCancelled(err)) return
    throw err
  }
}
