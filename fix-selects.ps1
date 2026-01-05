$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando selects y botones del header..." -ForegroundColor Cyan

# 1. Select de cambio de estado (línea ~1714)
$content = $content -replace 'className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1"', 'className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded px-2 py-1"'

# 2. Input de búsqueda en chat (línea ~1745)
$content = $content -replace 'className="h-8 px-2 rounded bg-slate-900 border border-slate-700 text-xs outline-none focus:border-emerald-400"', 'className="h-8 px-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-emerald-400"'

Set-Content $file $content -NoNewline

Write-Host "✅ Selects y búsqueda arreglados!" -ForegroundColor Green
Write-Host "   - Select de estado" -ForegroundColor White
Write-Host "   - Select de agente" -ForegroundColor White
Write-Host "   - Input de búsqueda" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
