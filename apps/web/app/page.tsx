import { Button } from '@zxkit/ui/button'
import { COMPONENTS_OPTIONS } from '@/lib/components'
import { SquareArrowOutUpRightIcon } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@zxkit/ui/card'
import Link from 'next/link'
import Image from 'next/image'

export default function Page() {
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {COMPONENTS_OPTIONS.map((comp) => (
        <Card key={comp.title}>
          <CardHeader>
            <CardTitle>{comp.title}</CardTitle>
            <CardDescription>{comp.description}</CardDescription>
            <CardAction>
              <Button asChild variant='ghost' size='icon-sm'>
                <Link href={comp.link} prefetch>
                  <SquareArrowOutUpRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Image
              src={comp.image.light}
              alt={comp.title}
              className='bg-muted/50 aspect-12/5 rounded-md object-cover dark:hidden'
              width={(12 / 5) * 300}
              height={300}
            />
            <Image
              src={comp.image.dark}
              alt={comp.title}
              className='bg-muted/50 hidden aspect-12/5 rounded-md object-cover dark:block'
              width={(12 / 5) * 300}
              height={300}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
