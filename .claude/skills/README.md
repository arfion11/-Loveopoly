# Katalog skill Loveopoly

Skill = instruksi yang dimuat Claude otomatis saat tugasnya cocok (atau dipanggil dengan `/nama-skill`). Skill
internal di folder ini ikut repo. Skill eksternal berasal dari plugin (dipasang per akun lewat `/plugin`, atau
didaftarkan untuk semua kolaborator di `.claude/settings.json`, lihat bagian bawah).

## Internal (khusus proyek ini)

| Peran | Skill | Untuk |
| --- | --- | --- |
| Developer | `loveopoly-aturan-game` | menambah/mengubah aturan engine sampai UI, uji & dokumentasi |
| Developer / QA | `loveopoly-qa-visual` | screenshot 4 ukuran × tema, WebKit/HP, bug "hanya di HP", a11y, performa |
| Developer / Desain | `loveopoly-animasi` | aturan animasi ringan + resep (View Transitions, kamera sinematik, koin, pegas) |
| Game design | `loveopoly-keseimbangan` | simulasi ribuan game: keadilan, comeback, tantangan, Love |
| Lead | `loveopoly-review` | review kode dengan daftar periksa khusus proyek |
| Lead / Ops | `loveopoly-rilis` | check → uji → commit → push → deploy → verifikasi live → CI; insiden & rollback |
| Desain | `loveopoly-desain` | token, tema, tipografi, Merpi, tata letak, penulisan UX Bahasa Indonesia |
| Product manager | `loveopoly-produk` | menilai ide, spesifikasi singkat, prioritas, roadmap & keputusan tertunda |
| Bisnis | `loveopoly-bisnis` | analitik GA4 & privasi, kuota/biaya Firebase, distribusi, monetisasi, positioning |

Alat pendukung (Node, di repo): `npm run balance:flow | balance:couple | balance:seat` (`tools/balance/`),
`npm run shots -- --preset <nama>` (`tools/qa/shots.mjs`).

## Eksternal (plugin)

Direkomendasikan untuk proyek ini:

| Plugin | Isi | Kapan | Status di akun pemilik |
| --- | --- | --- | --- |
| `superpowers@claude-plugins-official` | brainstorming, systematic-debugging, test-driven-development, writing-plans, verification-before-completion | proses kerja: rencana fitur besar, debug sistematis, bukti sebelum klaim selesai | terpasang |
| `playwright@claude-plugins-official` | kendali browser interaktif (MCP) | eksplorasi manual UI; uji otomatis tetap di `test/` | terpasang |
| `code-review@claude-plugins-official` | `/code-review` multi-level | review diff/PR menyeluruh | terpasang |
| `andrej-karpathy-skills@karpathy-skills` | pedoman coding: perubahan bedah, asumsi eksplisit | menulis/merombak kode | terpasang |
| `frontend-design@claude-plugins-official` | arah estetika & kritik desain yang tidak generik | layar/komponen baru, upgrade tampilan & animasi | **belum** |
| `claude-md-management@claude-plugins-official` | audit & perbarui CLAUDE.md | CLAUDE.md panjang: rapikan setelah fitur besar | **belum** |

Opsional (tidak disarankan aktif terus supaya daftar skill tetap ringkas): `pr-review-toolkit` (agen review khusus:
silent failure, tes, tipe), `security-guidance` (peringatan keamanan saat mengedit; menambah biaya tiap akhir giliran),
`example-skills@anthropic-agent-skills` (antara lain `webapp-testing` versi Python, `canvas-design` untuk
poster/og-image, `theme-factory`).

Sudah tersedia di akun pemilik (bukan lewat repo): `design:*` (accessibility-review, design-critique, ux-copy,
design-system, user-research), `engineering:*` (testing-strategy, deploy-checklist, incident-response, tech-debt,
architecture), `product-management:*` (write-spec, roadmap-update, metrics-review, competitive-brief,
synthesize-research), `anthropic-skills:skill-creator`.

Bila skill eksternal bertentangan dengan CLAUDE.md atau skill internal, **aturan proyek yang menang**.

### Mengaktifkan plugin eksternal

Per akun: jalankan `/plugin` di Claude Code, pilih marketplace `claude-plugins-official`, pasang `frontend-design`
dan `claude-md-management`.

Untuk semua kolaborator repo (diputuskan pemilik proyek, karena mengubah kemampuan agen): tambahkan ke
`.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-plugins-official": { "source": { "source": "github", "repo": "anthropics/claude-plugins-official" } },
    "karpathy-skills": { "source": { "source": "github", "repo": "forrestchang/andrej-karpathy-skills" } }
  },
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "playwright@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true,
    "andrej-karpathy-skills@karpathy-skills": true
  }
}
```

## Menambah / memperbaiki skill

Pakai `skill-creator`: satu folder per skill berisi `SKILL.md` (frontmatter `name` + `description` yang menyebut kapan
dipakai), detail panjang di `references/`, skrip di `scripts/` atau `tools/`. Tulis alasan di balik aturan, bukan
sekadar perintah. Perbarui katalog ini.
