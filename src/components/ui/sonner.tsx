import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>
type SonnerTheme = 'light' | 'dark' | 'system'

function useSonnerTheme(): SonnerTheme {
  const [theme, setTheme] = useState<SonnerTheme>('system')

  useEffect(() => {
    const read = (): SonnerTheme => {
      const t = document.documentElement.getAttribute('data-theme')
      return t === 'dark' || t === 'black' ? 'dark' : t === 'light' ? 'light' : 'system'
    }
    setTheme(read())
    const observer = new MutationObserver(() => setTheme(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSonnerTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
