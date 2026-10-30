#!/usr/bin/env node
/**
 * admin-formatos — publica el catálogo del módulo «Formatos» (build 176).
 *
 * La administración de los formatos vive FUERA de la app (regla del proyecto:
 * lo que se administra no se reimplementa dentro de lo que se distribuye). Los
 * formatos se describen en una carpeta del PC —fuera de este repositorio, que se
 * publica en GitHub Pages— con un `formatos.json` y los archivos al lado:
 *
 *   ..\Formatos-catalogo\formatos.json
 *   ..\Formatos-catalogo\FPJ 7 Rotulo Emp Y Ef.pdf
 *   …
 *
 * Este script compara esa carpeta con lo que está publicado y:
 *   · sube a Cloud Storage solo los archivos que cambiaron (SHA-256), en
 *     formatos/estandarizados/ (oficiales) o formatos/no_estandarizados/;
 *   · reescribe el catálogo `formatos/catalogo` de Firestore en UNA transacción
 *     y sube su número de versión, que es lo que los teléfonos comparan;
 *   · retira del catálogo (y borra del bucket) lo que salió de la lista.
 *
 * Publicar un formato NO exige actualizar la app en Play: los teléfonos lo ven
 * la próxima vez que entran al módulo con señal.
 *
 * Uso:
 *   npm run formatos                       simula: dice qué cambiaría, no toca nada
 *   npm run formatos -- --aplicar          publica
 *   npm run formatos -- --iniciar          crea la carpeta con el lote inicial
 *   opciones: --carpeta <ruta> · --bucket <nombre> · --emulador (Firestore y
 *   Storage locales, para las pruebas)
 *
 * Credencial: la clave de una cuenta de servicio del proyecto, en
 * ..\keystore-RESGUARDAR\firebase-admin-PRIVADA.json (o la variable
 * GOOGLE_APPLICATION_CREDENTIALS). ⚠️ Nunca dentro del repositorio.
 */
import { existsSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const flag = n => args.includes(n);

const EMULADOR = flag('--emulador');
const APLICAR = flag('--aplicar');
const CARPETA = resolve(opt('--carpeta') || join(RAIZ, '..', 'Formatos-catalogo'));
const PROYECTO = EMULADOR ? (opt('--proyecto') || 'demo-flagrante') : 'flagrante';
const BUCKET = opt('--bucket') || (EMULADOR ? PROYECTO + '.appspot.com' : 'flagrante.firebasestorage.app');
const CREDENCIAL = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(RAIZ, '..', 'keystore-RESGUARDAR', 'firebase-admin-PRIVADA.json');

const CATEGORIAS = { oficial: 'estandarizados', no_oficial: 'no_estandarizados' };
const EXT = {
  pdf:  { mime: 'application/pdf', magia: '%PDF' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magia: 'PK' }
};
const MAX_BYTES = 15 * 1048576;
const CAMPOS = ['nombre', 'codigo', 'categoria', 'fuente', 'norma', 'version', 'enlace', 'orden'];

const sha256 = b => createHash('sha256').update(b).digest('hex');
const fallar = m => { console.error('\n✗ ' + m + '\n'); process.exit(1); };

/* ── --iniciar: la carpeta con el lote inicial ──────────────────────────── */
if (flag('--iniciar')) {
  if (existsSync(join(CARPETA, 'formatos.json'))) fallar('Ya existe ' + join(CARPETA, 'formatos.json') + ' — no se sobrescribe.');
  mkdirSync(CARPETA, { recursive: true });
  const otro = join(RAIZ, 'Documentos', 'Otro');
  const lote = [
    { id: 'fpj-7-rotulo-emp-ef', nombre: 'Rótulo de EMP y EF', codigo: 'FPJ-7', categoria: 'oficial',
      fuente: 'Fiscalía General de la Nación', norma: 'Ley 906 de 2004, arts. 254-266 (cadena de custodia)',
      version: '', enlace: 'https://www.fiscalia.gov.co', orden: 10, pdf: 'FPJ 7 Rotulo Emp Y Ef.pdf' },
    { id: 'fpj-8-registro-cadena-custodia', nombre: 'Registro de cadena de custodia', codigo: 'FPJ-8', categoria: 'oficial',
      fuente: 'Fiscalía General de la Nación', norma: 'Ley 906 de 2004, arts. 254-266 (cadena de custodia)',
      version: '', enlace: 'https://www.fiscalia.gov.co', orden: 20, pdf: 'FPJ 8 Registro Cadena De Custodia.pdf' }
  ];
  for (const f of lote) {
    const o = join(otro, f.pdf);
    if (!existsSync(o)) fallar('No encuentro ' + o);
    copyFileSync(o, join(CARPETA, f.pdf));
  }
  writeFileSync(join(CARPETA, 'formatos.json'), JSON.stringify({ formatos: lote }, null, 2) + '\n');
  writeFileSync(join(CARPETA, 'LEEME.txt'), [
    'CATÁLOGO DEL MÓDULO «FORMATOS» DE FLAGRANTE',
    '',
    'Cada formato es una entrada de formatos.json:',
    '  id         identificador fijo, minúsculas y guiones (no se cambia nunca)',
    '  nombre     como se ve en la app',
    '  codigo     p. ej. FPJ-7 (opcional)',
    '  categoria  "oficial" o "no_oficial"',
    '  fuente     entidad que lo expide (opcional)',
    '  norma      norma que lo respalda (opcional; también se busca por ella)',
    '  version    versión del formato (opcional)',
    '  enlace     página oficial de la fuente, https:// (opcional)',
    '  orden      número para ordenar la lista (opcional)',
    '  pdf / docx nombre del archivo en esta carpeta (al menos uno)',
    '',
    'Para publicar: npm run formatos (simula) y npm run formatos -- --aplicar.',
    'Para retirar un formato: quítalo de la lista y vuelve a publicar.',
    '',
    'Candidatos que la app ya tiene en blanco (en ..\\Depuración\\06-documentos\\formatos-oficiales-en-blanco):',
    '  FPJ-5 URI, FPJ-5 CESPA, FPJ-6 Acta de derechos, FPJ-30 Acta de entrega, Acta de incautación (.docx).',
    ''
  ].join('\r\n'));
  console.log('✓ Carpeta creada: ' + CARPETA + '\n  Revisa formatos.json y publica con: npm run formatos -- --aplicar');
  process.exit(0);
}

/* ── Leer y validar la carpeta ──────────────────────────────────────────── */
const MANIFIESTO = join(CARPETA, 'formatos.json');
if (!existsSync(MANIFIESTO)) fallar('No existe ' + MANIFIESTO + ' — créala con: npm run formatos -- --iniciar');
let lista;
try { lista = JSON.parse(readFileSync(MANIFIESTO, 'utf8').replace(/^﻿/, '')).formatos; }
catch (e) { fallar('formatos.json no es JSON válido: ' + e.message); }
if (!Array.isArray(lista)) fallar('formatos.json tiene que tener una lista "formatos".');

const errores = [], vistos = new Set(), local = [];
lista.forEach((f, i) => {
  const donde = `formato ${i + 1}${f && f.id ? ' («' + f.id + '»)' : ''}`;
  if (!f || typeof f !== 'object') { errores.push(donde + ': no es un objeto'); return; }
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(f.id || '')) errores.push(donde + ': id inválido (minúsculas, números y guiones)');
  else if (vistos.has(f.id)) errores.push(donde + ': id repetido');
  vistos.add(f.id);
  if (!String(f.nombre || '').trim()) errores.push(donde + ': falta el nombre');
  if (!CATEGORIAS[f.categoria]) errores.push(donde + ': categoria tiene que ser "oficial" o "no_oficial"');
  if (f.enlace && !/^https:\/\/[^\s]+$/.test(f.enlace)) errores.push(donde + ': el enlace tiene que empezar por https://');
  const archivos = {};
  for (const k of Object.keys(EXT)) {
    if (!f[k]) continue;
    const p = join(CARPETA, f[k]);
    if (extname(p).toLowerCase() !== '.' + k) { errores.push(`${donde}: «${f[k]}» no es .${k}`); continue; }
    if (!existsSync(p)) { errores.push(`${donde}: no existe «${f[k]}»`); continue; }
    const tam = statSync(p).size;
    if (tam > MAX_BYTES) { errores.push(`${donde}: «${f[k]}» pasa de 15 MB`); continue; }
    const b = readFileSync(p);
    if (b.subarray(0, EXT[k].magia.length).toString('latin1') !== EXT[k].magia) { errores.push(`${donde}: «${f[k]}» no parece un .${k} de verdad`); continue; }
    archivos[k] = { buf: b, tam, sha256: sha256(b), origen: basename(p) };
  }
  if (!Object.keys(archivos).length) errores.push(donde + ': necesita al menos un archivo (pdf o docx)');
  local.push({ f, archivos });
});
if (errores.length) fallar('formatos.json tiene errores:\n  · ' + errores.join('\n  · '));

/* ── Firebase (administración) ──────────────────────────────────────────── */
if (EMULADOR) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
} else if (!existsSync(CREDENCIAL)) {
  fallar('Falta la clave de la cuenta de servicio: ' + CREDENCIAL +
    '\n  Créala en Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.');
}
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getStorage } = await import('firebase-admin/storage');
initializeApp(EMULADOR
  ? { projectId: PROYECTO, storageBucket: BUCKET }
  : { credential: cert(JSON.parse(readFileSync(CREDENCIAL, 'utf8'))), projectId: PROYECTO, storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket(BUCKET);
const REF = db.collection('formatos').doc('catalogo');

/* ── Comparar con lo publicado ──────────────────────────────────────────── */
const snap = await REF.get();
const publicado = snap.exists ? snap.data() : { version: 0, items: [] };
const antes = new Map((publicado.items || []).map(x => [x.id, x]));
const ahora = Date.now();
/* La ruta lleva parte del SHA: un archivo cambiado es un objeto NUEVO, así
   ninguna caché intermedia puede servir el anterior con el nombre de siempre. */
const ruta = (f, k, sha) => `formatos/${CATEGORIAS[f.categoria]}/${f.id}-${sha.slice(0, 12)}.${k}`;

const subir = [], borrar = [], items = [], resumen = [];
for (const { f, archivos } of local) {
  const prev = antes.get(f.id);
  const arch = {};
  let cambio = !prev;
  for (const k of Object.keys(archivos)) {
    const a = archivos[k], r = ruta(f, k, a.sha256);
    arch[k] = { ruta: r, tam: a.tam, sha256: a.sha256 };
    const pa = prev && prev.archivos && prev.archivos[k];
    if (!pa || pa.ruta !== r) { subir.push({ r, a, k }); cambio = true; }
  }
  if (prev) {
    for (const k of Object.keys(prev.archivos || {})) {
      if (!arch[k] || arch[k].ruta !== prev.archivos[k].ruta) { borrar.push(prev.archivos[k].ruta); cambio = true; }
    }
    for (const c of CAMPOS) if ((prev[c] ?? '') !== (f[c] ?? '') && !(c === 'orden' && (+prev[c] || 0) === (+f[c] || 0))) cambio = true;
  }
  const item = {
    id: f.id, nombre: String(f.nombre).trim(), codigo: String(f.codigo || '').trim(), categoria: f.categoria,
    fuente: String(f.fuente || '').trim(), norma: String(f.norma || '').trim(), version: String(f.version || '').trim(),
    enlace: String(f.enlace || '').trim(), orden: +f.orden || 0,
    creado: prev ? prev.creado : ahora, actualizado: cambio ? ahora : prev.actualizado, archivos: arch
  };
  items.push(item);
  if (!prev) resumen.push('+ nuevo       ' + f.id + ' — ' + item.nombre);
  else if (cambio) resumen.push('~ actualizado ' + f.id + ' — ' + item.nombre);
}
for (const [id, prev] of antes) {
  if (vistos.has(id)) continue;
  resumen.push('− retirado    ' + id + ' — ' + prev.nombre);
  for (const k of Object.keys(prev.archivos || {})) borrar.push(prev.archivos[k].ruta);
}

console.log(`\nCatálogo de Formatos · ${EMULADOR ? 'EMULADOR' : 'proyecto ' + PROYECTO} · bucket ${BUCKET}`);
console.log(`Carpeta: ${CARPETA}`);
console.log(`Publicado: versión ${publicado.version || 0}, ${antes.size} formato(s). En la carpeta: ${items.length}.\n`);
if (!resumen.length) { console.log('✓ Sin cambios: lo publicado ya es lo de la carpeta.\n'); process.exit(0); }
resumen.forEach(l => console.log('  ' + l));
console.log(`\n  Archivos por subir: ${subir.length} · por borrar: ${borrar.length}`);
if (!APLICAR) { console.log('\nSimulación: no se tocó nada. Para publicar: npm run formatos -- --aplicar\n'); process.exit(0); }

/* ── Publicar ───────────────────────────────────────────────────────────── */
// 1. Los archivos primero: un catálogo que apunta a un archivo que aún no existe
//    dejaría a un teléfono con un formato que no se puede abrir.
for (const s of subir) {
  await bucket.file(s.r).save(s.a.buf, {
    resumable: false, contentType: EXT[s.k].mime,
    metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { sha256: s.a.sha256, origen: s.a.origen } }
  });
  console.log('  ↑ ' + s.r);
}
// 2. El catálogo, en una transacción: si alguien publicó entretanto, no se pisa.
const nueva = await db.runTransaction(async tx => {
  const d = await tx.get(REF);
  const v = d.exists ? (+d.data().version || 0) : 0;
  if (v !== (+publicado.version || 0)) throw new Error('El catálogo cambió mientras se publicaba (versión ' + v + '). Vuelve a ejecutar.');
  tx.set(REF, { v: 1, version: v + 1, actualizado: ahora, items });
  return v + 1;
});
console.log('  ✓ catálogo publicado, versión ' + nueva);
// 3. Lo que ya no se usa, al final (si falla, sobra un archivo; no falta ninguno).
for (const r of [...new Set(borrar)]) {
  try { await bucket.file(r).delete(); console.log('  − ' + r); }
  catch (e) { console.warn('  ⚠ no se pudo borrar ' + r + ': ' + e.message); }
}
console.log('\n✓ Listo. Los teléfonos lo ven la próxima vez que entran a Formatos con señal.\n');
process.exit(0);
