$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando modal de plantillas y advertencia 24h..." -ForegroundColor Cyan

# 1. Mensaje "Fuera de la ventana de 24 horas"
# Título
$content = $content -replace 'text-amber-200 font-semibold', 'text-amber-900 dark:text-amber-200 font-semibold'

# Descripción del mensaje 24h
$content = $content -replace 'text-amber-300/80', 'text-amber-800 dark:text-amber-300/80'

# Fondo del mensaje 24h
$content = $content -replace 'bg-amber-900/20 border-amber-700/50', 'bg-amber-100 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700/50'

# 2. Modal de plantillas ya fue arreglado por el script anterior
# pero vamos a asegurarnos de que el contenido interno también esté bien

# Texto de descripción en cards de plantillas
$content = $content -replace 'text-xs text-slate-600 dark:text-slate-400', 'text-xs text-slate-700 dark:text-slate-400'

Set-Content $file $content -NoNewline

Write-Host "✅ Modal de plantillas y advertencia 24h arreglados!" -ForegroundColor Green
Write-Host "   - Mensaje 24h: Fondo ámbar claro, texto oscuro" -ForegroundColor White
Write-Host "   - Modal plantillas: Ya arreglado previamente" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
