$file = "src\components\ConversationsPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando botones de filtro..." -ForegroundColor Cyan

# Botones inactivos de filtro
$content = $content -replace "bg-slate-900 text-slate-400 hover:bg-slate-800", "bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800"

# Botón Activos (activo)
$content = $content -replace "bg-emerald-600/20 text-emerald-300 border border-emerald-600/60", "bg-emerald-100 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-600/60"

# Botón Favoritos (activo)
$content = $content -replace "bg-yellow-600/20 text-yellow-300 border border-yellow-600/60", "bg-yellow-100 dark:bg-yellow-600/20 text-yellow-700 dark:text-yellow-300 border border-yellow-400 dark:border-yellow-600/60"

# Botón Archivados (activo)
$content = $content -replace "bg-orange-600/20 text-orange-300 border border-orange-600/60", "bg-orange-100 dark:bg-orange-600/20 text-orange-700 dark:text-orange-300 border border-orange-400 dark:border-orange-600/60"

Set-Content $file $content -NoNewline

Write-Host "✅ Botones de filtro arreglados!" -ForegroundColor Green
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
