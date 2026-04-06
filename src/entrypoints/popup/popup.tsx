import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { toast } from 'sonner'
import { Toaster } from '../../components/ui/sonner'
import {
  HardDrive, Cloud, Loader2,
} from 'lucide-react'
import { CloudUploadIcon } from '../../components/ui/cloud-upload-icon'
import { CloudDownloadIcon } from '../../components/ui/cloud-download-icon'
import { DeleteIcon } from '../../components/ui/delete'
import { SettingsIcon } from '../../components/ui/settings-icon'
import { ArrowLeftIcon } from '../../components/ui/arrow-left-icon'
import { BookmarkIcon } from '../../components/ui/bookmark-icon'
import { GithubIcon } from '../../components/ui/github'
import { ArrowUpRightIcon, type ArrowUpRightIconHandle } from '../../components/ui/arrow-up-right'
import { DownloadIcon, type DownloadIconHandle } from '../../components/ui/download'
import { UploadIcon, type UploadIconHandle } from '../../components/ui/upload'
import { Separator } from '../../components/ui/separator'
import { Button } from '../../components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '../../components/ui/alert-dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { ButtonGroup } from '../../components/ui/button-group'
import { Slider } from '../../components/ui/slider'
import { useTheme, applyTheme, ThemeValue } from '../../utils/theme'
import optionsStorage from '../../utils/optionsStorage'
import '../../assets/globals.css'
import './popup.css'

type Action = 'upload' | 'download' | 'removeAll' | null

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

interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface MenuButtonProps {
  label: string
  icon: React.ReactElement
  action: Action
  destructive?: boolean
  loading: Action
  onAction: (action: Action) => void
}

const MenuButton: React.FC<MenuButtonProps> = ({
  label, icon, action, destructive = false, loading, onAction,
}) => {
  const iconRef = useRef<AnimatedIconHandle>(null)
  const clonedIcon = React.cloneElement(icon, { ref: iconRef })
  return (
    <button
      onClick={() => onAction(action)}
      disabled={!!loading}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      title={browser.i18n.getMessage(`${action}BookmarksDesc`) || undefined}
      className={[
        'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors',
        'disabled:opacity-40',
        destructive
          ? 'text-destructive hover:bg-accent'
          : 'hover:bg-accent hover:text-accent-foreground',
      ].join(' ')}
    >
      {loading === action
        ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        : clonedIcon}
      {label}
    </button>
  )
}

const ACTION_LABELS: Record<NonNullable<Action>, string> = {
  upload: 'Bookmarks uploaded',
  download: 'Bookmarks downloaded',
  removeAll: 'All bookmarks removed',
}

const Popup: React.FC = () => {
  useTheme()
  const [view, setView] = useState<'main' | 'settings'>('main')
  const [count, setCount] = useState({ local: '–', remote: '–' })
  const [loading, setLoading] = useState<Action>(null)
  const [opts, setOpts] = useState<Options>(DEFAULTS)
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshCount = () => {
    browser.storage.local.get(['localCount', 'remoteCount']).then(data => {
      setCount({
        local: data['localCount'] ?? '–',
        remote: data['remoteCount'] ?? '–',
      })
    })
  }

  useEffect(() => { refreshCount() }, [])

  useEffect(() => {
    optionsStorage.getAll().then(saved => {
      setOpts({ ...DEFAULTS, ...(saved as Partial<Options>) })
    })
  }, [])

  const debouncedSaveToast = () => {
    if (saveToastTimer.current) clearTimeout(saveToastTimer.current)
    saveToastTimer.current = setTimeout(() => toast.success('Settings saved'), 800)
  }

  const send = (name: Action) => {
    if (loading || !name) return
    setLoading(name)
    browser.runtime.sendMessage({ name })
      .then(ok => {
        if (ok) toast.success(ACTION_LABELS[name])
        else toast.error('Something went wrong')
      })
      .finally(() => { setLoading(null); refreshCount() })
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

  const settingsIconRef = useRef<AnimatedIconHandle>(null)
  const arrowIconRef = useRef<AnimatedIconHandle>(null)
  const removeAllIconRef = useRef<AnimatedIconHandle>(null)
  const exportIconRef = useRef<DownloadIconHandle>(null)
  const importIconRef = useRef<UploadIconHandle>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [fileLoading, setFileLoading] = useState<'export' | 'import' | null>(null)

  const handleExport = async () => {
    setFileLoading('export')
    try {
      const res: { ok: boolean; data?: string; error?: string } =
        await browser.runtime.sendMessage({ name: 'exportBookmarks' })
      if (!res.ok) throw new Error(res.error)
      const blob = new Blob([res.data!], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Bookmarks exported')
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setFileLoading(null)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setFileLoading('import')
    try {
      const text = await file.text()
      const res: { ok: boolean; error?: string } =
        await browser.runtime.sendMessage({ name: 'importBookmarks', data: text })
      if (!res.ok) throw new Error(res.error)
      refreshCount()
      toast.success('Bookmarks imported')
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`)
    } finally {
      setFileLoading(null)
    }
  }
  const goToSettingsIconRef = useRef<AnimatedIconHandle>(null)
  const githubIconRef = useRef<AnimatedIconHandle>(null)
  const tokenLinkIconRef = useRef<ArrowUpRightIconHandle>(null)

  if (view === 'settings') {
    return (
      <div className="flex flex-col bg-background text-foreground">
        <Toaster position="top-center" duration={2000} />
        {/* Settings header */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => setView('main')}
            onMouseEnter={() => arrowIconRef.current?.startAnimation()}
            onMouseLeave={() => arrowIconRef.current?.stopAnimation()}
            className="flex items-center justify-center rounded p-1 hover:bg-accent transition-colors"
          >
            <ArrowLeftIcon ref={arrowIconRef} size={16} />
          </button>
          <span className="text-sm font-semibold">Settings</span>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 px-4 py-3">
          {/* GitHub Token */}
          <div className="space-y-1">
            <Label htmlFor="githubToken" className="text-xs">{browser.i18n.getMessage('githubToken')}</Label>
            <div className="flex gap-1.5">
              <Input
                id="githubToken"
                type="text"
                placeholder="ghp_xxxxxxxxxxxx"
                value={opts.githubToken}
                onChange={e => set('githubToken', e.target.value)}
                className="flex-1 h-7 text-xs"
              />
              <Button variant="outline" size="sm" asChild className="h-7 px-2">
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  className="flex items-center gap-1"
                  onMouseEnter={() => tokenLinkIconRef.current?.startAnimation()}
                  onMouseLeave={() => tokenLinkIconRef.current?.stopAnimation()}
                >
                  <ArrowUpRightIcon ref={tokenLinkIconRef} size={12} />
                </a>
              </Button>
            </div>
          </div>

          {/* Gist ID */}
          <div className="space-y-1">
            <Label htmlFor="gistID" className="text-xs">{browser.i18n.getMessage('gistID')}</Label>
            <Input
              id="gistID"
              placeholder="a1b2c3d4e5f6..."
              value={opts.gistID}
              onChange={e => set('gistID', e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          {/* Gist File Name */}
          <div className="space-y-1">
            <Label htmlFor="gistFileName" className="text-xs">{browser.i18n.getMessage('gistFileName')}</Label>
            <Input
              id="gistFileName"
              placeholder="BookmarkHub"
              value={opts.gistFileName}
              onChange={e => set('gistFileName', e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2.5 px-4 py-3">
          {/* Notifications */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">{browser.i18n.getMessage('enableNotifications')}</Label>
            <Switch
              checked={opts.enableNotify}
              onCheckedChange={v => set('enableNotify', v, v ? 'Notifications enabled' : 'Notifications disabled')}
            />
          </div>

          {/* Auto Sync */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className={`text-xs${!isGistConfigured ? ' text-muted-foreground' : ''}`}>Auto Sync</Label>
              {!isGistConfigured && (
                <p className="text-xs text-muted-foreground">Set token &amp; Gist ID first</p>
              )}
            </div>
            <Switch
              checked={opts.autoSync}
              disabled={!isGistConfigured}
              onCheckedChange={v => setSyncSetting('autoSync', v, v ? 'Auto sync enabled' : 'Auto sync disabled')}
            />
          </div>

          {opts.autoSync && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Check interval</Label>
                <span className="text-xs font-semibold tabular-nums">{opts.autoSyncInterval} min</span>
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
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <Label className="text-xs">Theme</Label>
          <ButtonGroup
            value={opts.theme}
            onChange={v => { set('theme', v, `Theme set to ${v}`); applyTheme(v) }}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light',  label: 'Light'  },
              { value: 'dark',   label: 'Dark'   },
              { value: 'black',  label: 'Black'  },
            ]}
            className="w-full"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-background text-foreground">
      <Toaster position="top-center" duration={2000} />
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <BookmarkIcon size={16} className="text-primary" />
        <span className="text-sm font-semibold tracking-tight">BookmarkHub</span>
      </div>

      <Separator />

      {/* Actions */}
      {!isGistConfigured ? (
        <div className="flex flex-col gap-2 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Configure your GitHub token and Gist ID to upload or download bookmarks.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setView('settings')}
            onMouseEnter={() => goToSettingsIconRef.current?.startAnimation()}
            onMouseLeave={() => goToSettingsIconRef.current?.stopAnimation()}
            className="w-full h-7 text-xs gap-1.5"
          >
            <SettingsIcon ref={goToSettingsIconRef} size={12} />
            Go to Settings
          </Button>
        </div>
      ) : (
        <div className="flex flex-col py-1">
          <MenuButton label={browser.i18n.getMessage('uploadBookmarks')}   icon={<CloudUploadIcon size={16} className="shrink-0" />}   action="upload"    loading={loading} onAction={send} />
          <MenuButton label={browser.i18n.getMessage('downloadBookmarks')} icon={<CloudDownloadIcon size={16} className="shrink-0" />} action="download"  loading={loading} onAction={send} />
        </div>
      )}

      <Separator />

      {/* File import / export */}
      <div className="flex flex-col py-1">
        <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        <button
          onClick={handleExport}
          disabled={!!fileLoading}
          onMouseEnter={() => exportIconRef.current?.startAnimation()}
          onMouseLeave={() => exportIconRef.current?.stopAnimation()}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:opacity-40 hover:bg-accent hover:text-accent-foreground"
        >
          {fileLoading === 'export'
            ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            : <DownloadIcon ref={exportIconRef} size={16} className="shrink-0" />}
          Export to file
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              disabled={!!fileLoading}
              onMouseEnter={() => importIconRef.current?.startAnimation()}
              onMouseLeave={() => importIconRef.current?.stopAnimation()}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:opacity-40 hover:bg-accent hover:text-accent-foreground"
            >
              {fileLoading === 'import'
                ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                : <UploadIcon ref={importIconRef} size={16} className="shrink-0" />}
              Import from file
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100vw-2rem)] p-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Import bookmarks?</AlertDialogTitle>
              <AlertDialogDescription>
                This will replace all your current bookmarks with the contents of the file.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => importFileRef.current?.click()}>
                Choose file
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Separator />

      {/* Danger zone */}
      <AlertDialog>
        <div className="flex flex-col py-1">
          <AlertDialogTrigger asChild>
            <button
              disabled={!!loading}
              onMouseEnter={() => removeAllIconRef.current?.startAnimation()}
              onMouseLeave={() => removeAllIconRef.current?.stopAnimation()}
              title={browser.i18n.getMessage('removeAllBookmarksDesc') || undefined}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors disabled:opacity-40 text-destructive hover:bg-accent"
            >
              {loading === 'removeAll'
                ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                : <DeleteIcon ref={removeAllIconRef} size={16} className="shrink-0" />}
              {browser.i18n.getMessage('removeAllBookmarks')}
            </button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent className="w-[calc(100vw-2rem)] p-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all bookmarks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all local bookmarks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => send('removeAll')}
            >
              Remove all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator />

      {/* Settings */}
      <div className="py-1">
        <button
          onClick={() => setView('settings')}
          onMouseEnter={() => settingsIconRef.current?.startAnimation()}
          onMouseLeave={() => settingsIconRef.current?.stopAnimation()}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <SettingsIcon ref={settingsIconRef} size={16} className="shrink-0" />
          {browser.i18n.getMessage('settings')}
        </button>
      </div>

      <Separator />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1" title={browser.i18n.getMessage('localCount')}>
            <HardDrive className="h-3 w-3" />{count.local}
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1" title={browser.i18n.getMessage('remoteCount')}>
            <Cloud className="h-3 w-3" />{count.remote}
          </span>
        </div>
        <a
          href="https://github.com/dudor/BookmarkHub"
          target="_blank"
          title={browser.i18n.getMessage('help')}
          className="hover:text-foreground transition-colors"
          onMouseEnter={() => githubIconRef.current?.startAnimation()}
          onMouseLeave={() => githubIconRef.current?.stopAnimation()}
        >
          <GithubIcon ref={githubIconRef} size={14} />
        </a>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
)
