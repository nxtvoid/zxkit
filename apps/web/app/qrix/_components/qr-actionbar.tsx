import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { CopyIcon, DownloadCloudIcon, FileCodeIcon, ImageIcon, RotateCwIcon } from 'lucide-react'
import {
  copyQRCodeToClipboard,
  downloadQRCodePNG,
  downloadQRCodeSVG,
  type QRCodeSVGProps,
} from '@zxkit/qrix'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

type QrActionBarProps = {
  qrData: QRCodeSVGProps
  handleReset: () => void
}

const QrActionBar = ({ qrData, handleReset }: QrActionBarProps) => {
  return (
    <div className='flex items-center gap-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className='cursor-pointer gap-2' size='sm' variant='secondary'>
            <DownloadCloudIcon />
            Download
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={async () => {
              toast.promise(downloadQRCodePNG(qrData), {
                loading: 'Downloading QR Code...',
                success: 'QR Code downloaded!',
                error: 'Failed to download QR Code.',
              })
            }}
          >
            <ImageIcon />
            PNG
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              toast.promise(downloadQRCodeSVG(qrData), {
                loading: 'Downloading QR Code...',
                success: 'QR Code downloaded!',
                error: 'Failed to download QR Code.',
              })
            }}
          >
            <FileCodeIcon />
            SVG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        className='cursor-pointer gap-2'
        size='sm'
        variant='secondary'
        onClick={async () => {
          toast.promise(copyQRCodeToClipboard(qrData), {
            loading: 'Copying QR Code...',
            success: 'QR Code copied!',
            error: 'Failed to copy QR Code.',
          })
        }}
      >
        <CopyIcon />
        Copy
      </Button>
      <Button
        className='cursor-pointer gap-2'
        size='sm'
        variant='destructive'
        onClick={handleReset}
      >
        <RotateCwIcon />
        Reset
      </Button>
    </div>
  )
}
export { QrActionBar }
