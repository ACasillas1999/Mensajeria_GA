$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando modales y botones..." -ForegroundColor Cyan

# Modal de reacciones
$content = $content -replace 'bg-slate-900 border border-slate-700 rounded-lg shadow-xl', 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl'

# Hover de botones de reacción
$content = $content -replace 'hover:bg-slate-800 transition', 'hover:bg-slate-200 dark:hover:bg-slate-800 transition'

# Modal de plantillas (showTemplates)
$content = $content -replace 'bg-slate-950 border border-slate-800 rounded-2xl', 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl'

# Cards dentro de modales
$content = $content -replace 'bg-slate-900/50 border border-slate-800', 'bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800'

# Texto en modales
$content = $content -replace 'text-slate-400 text-sm', 'text-slate-600 dark:text-slate-400 text-sm'
$content = $content -replace 'text-slate-200\\"', 'text-slate-900 dark:text-slate-200"'

# Botones de acción
$content = $content -replace 'bg-slate-800 hover:bg-slate-700', 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'

# Panel de sugerencias
$content = $content -replace 'bg-slate-950 border border-slate-700', 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700'

Set-Content $file $content -NoNewline

Write-Host "✅ Modales y botones arreglados!" -ForegroundColor Green
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
