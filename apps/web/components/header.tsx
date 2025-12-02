import { Button } from '@workspace/ui/components/button'
import { GithubIcon, LogoAppIcon } from '@workspace/ui/components/icons'
import { ModeSwitcher } from '@workspace/ui/components/mode-switcher'
import Link from 'next/link'

const Header = () => {
  return (
    <header className='border-border bg-background/50 sticky top-0 z-50 flex h-16 w-full border-b backdrop-blur-sm'>
      <div className='container mx-auto flex max-w-7xl items-center justify-between px-6'>
        <Button className='font-medium tracking-tight' asChild variant='ghost' size='sm'>
          <Link href='/'>
            <LogoAppIcon className='size-5 min-w-5' />
            zxkit
          </Link>
        </Button>

        <div className='flex items-center gap-2'>
          <Button className='font-medium tracking-tight' variant='ghost' size='icon' asChild>
            <Link href='https://github.com/nxtvoid/zxkit' target='_blank' rel='noopener noreferrer'>
              <GithubIcon className='size-4 min-w-4' />
            </Link>
          </Button>
          <ModeSwitcher />
        </div>
      </div>
    </header>
  )
}

export { Header }
