$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

# Arreglar textarea de comentarios
$content = $content -replace 'className="resize-none flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-sky-400"', 'className="resize-none flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-400"'

Set-Content $file $content -NoNewline

Write-Host "✅ Textarea de comentarios arreglado!" -ForegroundColor Green
