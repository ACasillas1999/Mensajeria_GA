$file1 = "src\components\LocationPicker.jsx"
$content1 = Get-Content $file1 -Raw

Write-Host "Arreglando LocationPicker..." -ForegroundColor Cyan

# Modal principal
$content1 = $content1 -replace 'bg-slate-950 border border-slate-800', 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800'

# Header border
$content1 = $content1 -replace 'border-b border-slate-800', 'border-b border-slate-300 dark:border-slate-800'

# Título
$content1 = $content1 -replace 'font-semibold text-lg', 'font-semibold text-lg text-slate-900 dark:text-slate-100'

# Botón cerrar
$content1 = $content1 -replace 'bg-slate-800 hover:bg-slate-700 text-sm', 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm'

# Tabs inactivos
$content1 = $content1 -replace "bg-slate-800 hover:bg-slate-700 text-slate-300", "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"

# Texto
$content1 = $content1 -replace 'text-slate-300', 'text-slate-700 dark:text-slate-300'
$content1 = $content1 -replace 'text-slate-200', 'text-slate-900 dark:text-slate-200'
$content1 = $content1 -replace 'text-slate-400', 'text-slate-600 dark:text-slate-400'

# Input de búsqueda
$content1 = $content1 -replace 'bg-slate-900 border border-slate-700', 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'

# Resultados de búsqueda
$content1 = $content1 -replace 'bg-slate-900 hover:bg-slate-800 border border-slate-700', 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700'

# Border del mapa
$content1 = $content1 -replace 'border-slate-700', 'border-slate-300 dark:border-slate-700'

Set-Content $file1 $content1 -NoNewline

Write-Host "✅ LocationPicker arreglado!" -ForegroundColor Green
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
