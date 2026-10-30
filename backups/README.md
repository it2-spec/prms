# PRMS Database Snapshot — Versi 1.0.0 (Release)

Tanggal Snapshot: **30 Oktober 2026**  
Basis Database: **PostgreSQL (Local / Development)**  
Nama Database: `prms`

---

## Berkas Snapshot yang Tersedia

1. **`prms_v1.0.0_snapshot_20261030.sql`** (Plain SQL Format)
   * Berisi seluruh DDL skema tabel, relasi foreign key, indeks, constraint, dan data baris tabel (INSERT).
   * Dapat dibuka di text editor atau dieksekusi langsung lewat psql / pgAdmin Query Tool.

2. **`prms_v1.0.0_snapshot_20261030.dump`** (PostgreSQL Custom Compressed Format)
   * Format biner terkompresi resmi PostgreSQL.
   * Sangat cepat dan aman saat dipulihkan menggunakan `pg_restore`.

---

## Cara Melakukan Pemulihan (Restore Database)

Jika suatu saat Anda ingin mengembalikan kondisi database persis seperti saat Versi 1.0.0 ini:

### Opsi A: Menggunakan `pg_restore` (Direkomendasikan)
Buka terminal PowerShell, lalu jalankan:

```powershell
# Set password postgres
$env:PGPASSWORD="postgres"

# Restore file .dump ke database prms
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -U postgres -h localhost -p 5432 -d prms --clean --if-exists -v "backups/prms_v1.0.0_snapshot_20261030.dump"
```

### Opsi B: Menggunakan File `.sql` (via psql)
```powershell
$env:PGPASSWORD="postgres"

& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5432 -d prms -f "backups/prms_v1.0.0_snapshot_20261030.sql"
```

### Opsi C: Menggunakan pgAdmin (GUI)
1. Buka **pgAdmin 4**.
2. Klik kanan pada database `prms` $\to$ pilih **Restore...**
3. Di tab **General**, pilih format *Custom or tar* dan arahkan ke file `prms_v1.0.0_snapshot_20261030.dump`.
4. Klik tombol **Restore**.
