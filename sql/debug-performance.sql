-- Script para diagnosticar problemas de rendimiento

-- 1. Verificar bloqueos activos
SELECT
    r.trx_id waiting_trx_id,
    r.trx_mysql_thread_id waiting_thread,
    r.trx_query waiting_query,
    b.trx_id blocking_trx_id,
    b.trx_mysql_thread_id blocking_thread,
    b.trx_query blocking_query
FROM information_schema.innodb_lock_waits w
INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;

-- 2. Ver transacciones activas
SELECT * FROM information_schema.innodb_trx;

-- 3. Procesos activos
SHOW FULL PROCESSLIST;

-- 4. Variables de timeout
SHOW VARIABLES LIKE '%timeout%';

-- 5. Verificar tamaño de tablas
SELECT
    table_name,
    table_rows,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'mensajeria_ga'
ORDER BY (data_length + index_length) DESC;
