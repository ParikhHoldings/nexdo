'use client'

import { useState, useRef, type ReactNode, type ChangeEvent } from 'react'
import { CheckCircle2, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface ImportPreview {
  count: number
  sampleTitles: string[]
  warning?: string | null
}

export interface ImportSourceCardProps {
  name: string
  description: string
  icon: ReactNode
  type: 'file' | 'token'
  onImport: (data: { token?: string; file?: File }) => Promise<void>
  onPreview?: (data: { file: File }) => Promise<ImportPreview>
  isLoading?: boolean
  isComplete?: boolean
  importedCount?: number
  error?: string | null
  fileAccept?: string
  tokenPlaceholder?: string
  instructions?: string
}

export function ImportSourceCard({
  name,
  description,
  icon,
  type,
  onImport,
  onPreview,
  isLoading = false,
  isComplete = false,
  importedCount,
  error,
  fileAccept = '.csv,.ics,.json',
  tokenPlaceholder = 'Enter API token',
  instructions,
}: ImportSourceCardProps) {
  const [token, setToken] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTokenSubmit = async () => {
    if (!token.trim()) return
    await onImport({ token: token.trim() })
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setPreview(null)
    setPreviewError(null)

    if (!onPreview) {
      await onImport({ file })
      return
    }

    setIsPreviewing(true)
    try {
      const nextPreview = await onPreview({ file })
      setPreview(nextPreview)
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : 'Could not preview this file.'
      )
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleConfirmFileImport = async () => {
    if (!selectedFile) return
    await onImport({ file: selectedFile })
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-zinc-900/50 p-5 transition-all duration-200',
        isComplete
          ? 'border-green-500/50 bg-green-500/5'
          : error
            ? 'border-red-500/50'
            : 'border-zinc-800 hover:border-zinc-700'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-100">{name}</h3>
            {isComplete && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">{description}</p>
        </div>
      </div>

      {/* Instructions */}
      {instructions && (
        <p className="mt-3 text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3">
          {instructions}
        </p>
      )}

      {/* Input Area */}
      {!isComplete && (
        <div className="mt-4">
          {type === 'token' && (
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={tokenPlaceholder}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isLoading}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTokenSubmit()
                }}
              />
              <Button
                onClick={handleTokenSubmit}
                disabled={!token.trim() || isLoading}
                isLoading={isLoading}
              >
                {isLoading ? 'Importing...' : 'Import'}
              </Button>
            </div>
          )}

          {type === 'file' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={fileAccept}
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-all',
                  isDragging
                    ? 'border-accent bg-accent/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isLoading || isPreviewing ? (
                  <>
                    <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
                    <span className="text-sm text-zinc-400">
                      {isPreviewing ? 'Previewing...' : 'Importing...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-zinc-500" />
                    <span className="text-sm text-zinc-400">
                      {selectedFile
                        ? selectedFile.name
                        : 'Drop file here or click to browse'}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Accepts {fileAccept}
                    </span>
                  </>
                )}
              </div>
              {preview && (
                <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">
                        {preview.count} task{preview.count !== 1 ? 's' : ''} ready
                      </p>
                      {preview.sampleTitles.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                          {preview.sampleTitles.map((title) => (
                            <li key={title} className="truncate">
                              {title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleConfirmFileImport}
                      isLoading={isLoading}
                    >
                      Import
                    </Button>
                  </div>
                  {preview.warning && (
                    <p className="text-xs text-amber-400">{preview.warning}</p>
                  )}
                </div>
              )}
              {previewError && (
                <p className="mt-3 text-sm text-red-400">{previewError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Success State */}
      {isComplete && importedCount !== undefined && (
        <div className="mt-4 flex items-center gap-2 text-green-500">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            {importedCount} task{importedCount !== 1 ? 's' : ''} imported successfully
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
