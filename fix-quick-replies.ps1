$file = "src\components\QuickReplies.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando QuickReplies..." -ForegroundColor Cyan

# Modal principal
$content = $content -replace 'bg-slate-950 border border-slate-800', 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800'

# Formulario de crear
$content = $content -replace 'border-b border-slate-800 bg-slate-900/50', 'border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50'

# Inputs
$content = $content -replace 'bg-slate-900 border border-slate-700', 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'

# Cards de respuestas
$content = $content -replace 'border border-slate-800 bg-slate-900/50 hover:bg-slate-800/70', 'border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800/70'

# Texto
$content = $content -replace 'text-slate-200', 'text-slate-900 dark:text-slate-200'
$content = $content -replace 'text-slate-300', 'text-slate-700 dark:text-slate-300'
$content = $content -replace 'text-slate-400', 'text-slate-600 dark:text-slate-400'

Set-Content $file $content -NoNewline

Write-Host "✅ QuickReplies arreglado!" -ForegroundColor Green
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
