import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { toast } from 'sonner'
import { ArrowUpRightIcon, type ArrowUpRightIconHandle } from '../../components/ui/arrow-up-right'
import { Toaster } from '../../components/ui/sonner'
import { Button } from '../../components/ui/button'
import { Slider } from '../../components/ui/slider'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Separator } from '../../components/ui/separator'
import { useTheme, applyTheme, ThemeValue } from '../../utils/theme'
import { ButtonGroup } from '../../components/ui/button-group'
import optionsStorage from '../../utils/optionsStorage'
import '../../assets/globals.css'
import './options.css'

interface Options {
  githubToken: string
  gistID: string
  gistFileName: string
  enableNotify: boolean
  autoSync: boolean
  autoSyncInterval: number
  theme: ThemeValue
}

const DEFAULTS: Options = {
  githubToken: '',
  gistID: '',
  gistFileName: 'BookmarkHub',
  enableNotify: true,
  autoSync: false,
  autoSyncInterval: 5,
  theme: 'system',
}

const SYNC_INTERVALS = [5, 10, 15, 30, 60]

async function saveOptions(next: Options) {
  await optionsStorage.set(next)
}

const OptionsPage: React.FC = () => {
  useTheme()
  const [opts, setOpts] = useState<Options>(DEFAULTS)
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    optionsStorage.getAll().then(saved => {
      setOpts({ ...DEFAULTS, ...(saved as Partial<Options>) })
    })
  }, [])

  const debouncedSaveToast = () => {
    if (saveToastTimer.current) clearTimeout(saveToastTimer.current)
    saveToastTimer.current = setTimeout(() => toast.success('Settings saved'), 800)
  }

  const set = <K extends keyof Options>(key: K, value: Options[K], msg?: string) => {
    const next = { ...opts, [key]: value }
    setOpts(next)
    saveOptions(next)
    if (msg !== undefined) toast.success(msg)
    else debouncedSaveToast()
  }

  const setSyncSetting = <K extends keyof Options>(key: K, value: Options[K], msg?: string) => {
    set(key, value, msg)
    browser.runtime.sendMessage({ name: 'settingChanged' })
  }

  const isGistConfigured = !!(opts.githubToken.trim() && opts.gistID.trim())
  const tokenLinkIconRef = useRef<ArrowUpRightIconHandle>(null)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="bottom-right" />
      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure BookmarkHub sync</p>
        </div>

        <Separator />

        {/* GitHub section */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="githubToken">{browser.i18n.getMessage('githubToken')}</Label>
            <div className="flex gap-2">
              <Input
                id="githubToken"
                type="text"
                placeholder="ghp_xxxxxxxxxxxx"
                value={opts.githubToken}
                onChange={e => set('githubToken', e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  className="flex items-center gap-1.5"
                  onMouseEnter={() => tokenLinkIconRef.current?.startAnimation()}
                  onMouseLeave={() => tokenLinkIconRef.current?.stopAnimation()}
                >
                  Get Token <ArrowUpRightIcon ref={tokenLinkIconRef} size={12} />
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gistID">{browser.i18n.getMessage('gistID')}</Label>
            <Input
              id="gistID"
              placeholder="a1b2c3d4e5f6..."
              value={opts.gistID}
              onChange={e => set('gistID', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gistFileName">{browser.i18n.getMessage('gistFileName')}</Label>
            <Input
              id="gistFileName"
              placeholder="BookmarkHub"
              value={opts.gistFileName}
              onChange={e => set('gistFileName', e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Notifications + Auto Sync */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{browser.i18n.getMessage('enableNotifications')}</Label>
              <p className="text-xs text-muted-foreground">Show a notification after each sync</p>
            </div>
            <Switch
              checked={opts.enableNotify}
              onCheckedChange={v => set('enableNotify', v, v ? 'Notifications enabled' : 'Notifications disabled')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className={!isGistConfigured ? 'text-muted-foreground' : ''}>Auto Sync</Label>
              <p className="text-xs text-muted-foreground">
                {isGistConfigured
                  ? 'Upload on change · download when remote changes'
                  : 'Set your GitHub token and Gist ID above to enable'}
              </p>
            </div>
            <Switch
              checked={opts.autoSync}
              disabled={!isGistConfigured}
              onCheckedChange={v => setSyncSetting('autoSync', v, v ? 'Auto sync enabled' : 'Auto sync disabled')}
            />
          </div>

          {opts.autoSync && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Check interval</Label>
                <span className="text-sm font-semibold tabular-nums">{opts.autoSyncInterval} min</span>
              </div>
              <Slider
                min={0}
                max={SYNC_INTERVALS.length - 1}
                step={1}
                value={[Math.max(0, SYNC_INTERVALS.indexOf(opts.autoSyncInterval))]}
                onValueChange={([i]) => setSyncSetting('autoSyncInterval', SYNC_INTERVALS[i], `Sync interval set to ${SYNC_INTERVALS[i]} min`)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {SYNC_INTERVALS.map(v => <span key={v}>{v}m</span>)}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Theme */}
        <div className="flex items-center justify-between">
          <Label>Theme</Label>
          <ButtonGroup
            value={opts.theme}
            onChange={v => { set('theme', v, `Theme set to ${v}`); applyTheme(v) }}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light',  label: 'Light'  },
              { value: 'dark',   label: 'Dark'   },
              { value: 'black',  label: 'Black'  },
            ]}
          />
        </div>


        <Separator />

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          <a
            href="https://github.com/dudor/BookmarkHub"
            target="_blank"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {browser.i18n.getMessage('help')}
          </a>
        </p>

      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>
)
