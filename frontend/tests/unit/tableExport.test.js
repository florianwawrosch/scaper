// lib/tableExport: Dateiname aus dem Datensatznamen
const { ok, lib } = require('./setup');
const { exportSlug } = lib('tableExport');
ok(exportSlug('Meta: fitness coaching') === 'fitness-coaching', 'Meta-Präfix weg, Leerzeichen → Bindestrich');
ok(exportSlug('leads.csv') === 'leads' && exportSlug('Kunden Liste.XLSX') === 'kunden-liste', 'Dateiendung weg');
ok(exportSlug('') === 'export' && exportSlug(undefined) === 'export' && exportSlug('Meta: ') === 'export', 'leer → export');
ok(exportSlug('Ärzte & Coaches (DE)') === 'ärzte-coaches-de', 'Sonderzeichen raus, Umlaute bleiben');
ok(exportSlug('x'.repeat(80)).length === 40, 'auf 40 Zeichen gekürzt');
