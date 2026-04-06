import { useEffect } from 'react'
import optionsStorage from './optionsStorage'

export type ThemeValue = 'system' | 'light' | 'dark' | 'black'

export function applyTheme(theme: ThemeValue): (() => void) {
    if (theme === 'system') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const update = (dark: boolean) =>
            document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
        update(mq.matches)
        const handler = (e: MediaQueryListEvent) => update(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }
    document.documentElement.setAttribute('data-theme', theme)
    return () => {}
}

export function useTheme() {
    useEffect(() => {
        let cleanup = () => {}
        optionsStorage.getAll().then(options => {
            const theme = (options.theme as ThemeValue) || 'system'
            cleanup = applyTheme(theme)
        })
        return () => cleanup()
    }, [])
}
