/* Jacowaco's Games · caza de fotos · backend de respaldo en Google (Drive + Sheets)
   Instalación en fotos/LEEME.md. Cambiá CAMBIAR_CLAVE por la misma clave que pusiste en Supabase. */
const CLAVE = 'CAMBIAR_CLAVE';

// Correr una vez desde el editor (▶ con "setup" elegido): crea la hoja, la carpeta de Drive y pide los permisos
function setup() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('fotos') || ss.insertSheet('fotos');
  if (hoja.getLastRow() === 0) hoja.appendRow(['id', 'equipo', 'consigna', 'archivo', 'estado', 'creada', 'revisada', 'autor']);
  props.setProperty('PLANILLA', ss.getId());
  if (!props.getProperty('CARPETA')) {
    const carpeta = DriveApp.createFolder("Jacowaco's Games · fotos");
    // Los archivos heredan el "cualquiera con el link", así el panel puede mostrarlos
    carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('CARPETA', carpeta.getId());
  }
  if (!props.getProperty('CONSIGNAS')) props.setProperty('CONSIGNAS', '[]');
}

function doGet() {
  try { return responder(estado(false)); }
  catch (err) { return responder({ error: String(err.message || err) }); }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.accion === 'subir') return responder(subir(d));
    if (d.clave !== CLAVE) throw new Error('clave incorrecta');
    const props = PropertiesService.getScriptProperties();
    switch (d.accion) {
      case 'admin': return responder(estado(true));
      case 'revisar': return responder(revisar(String(d.id), String(d.estado)));
      case 'guardar':
        props.setProperty('CONSIGNAS', JSON.stringify(d.consignas || []));
        return responder({ ok: true });
      case 'largar':
        if (d.largar) props.setProperty('INICIO', String(Date.now())); else props.deleteProperty('INICIO');
        return responder({ ok: true });
      case 'reiniciar':
        conLock(() => { const h = hoja(); if (h.getLastRow() > 1) h.deleteRows(2, h.getLastRow() - 1); });
        props.deleteProperty('INICIO');
        return responder({ ok: true });
    }
    throw new Error('acción desconocida');
  } catch (err) {
    return responder({ error: String(err.message || err) });
  }
}

// Mismo formato que la función estado() de Supabase; el panel además recibe la URL de cada foto
function estado(admin) {
  const props = PropertiesService.getScriptProperties();
  const inicio = Number(props.getProperty('INICIO')) || null;
  const filas = hoja().getDataRange().getValues().slice(1);
  return {
    inicio: inicio,
    consignas: admin || inicio ? JSON.parse(props.getProperty('CONSIGNAS') || '[]') : null,
    fotos: filas.map(f => {
      const foto = { id: String(f[0]), equipo: String(f[1]), consigna: Number(f[2]), estado: String(f[4]), creada: Number(f[5]), autor: String(f[7] || '') };
      if (admin) foto.url = 'https://drive.google.com/thumbnail?id=' + f[3] + '&sz=w1600';
      return foto;
    }),
  };
}

function subir(d) {
  const creada = Date.now();
  if (!PropertiesService.getScriptProperties().getProperty('INICIO')) throw new Error('el juego todavía no largó');
  const carpeta = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('CARPETA'));
  const nombre = d.equipo + '-' + d.consigna + '-' + creada + '.jpg';
  const archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(d.imagen), 'image/jpeg', nombre));
  const id = Utilities.getUuid();
  const autor = String(d.autor || '').slice(0, 30);
  conLock(() => hoja().appendRow([id, String(d.equipo), Number(d.consigna), archivo.getId(), 'pendiente', creada, '', autor]));
  return { id: id, creada: creada };
}

function revisar(id, nuevo) {
  return conLock(() => {
    const h = hoja();
    const n = h.getLastRow() - 1;
    const ids = n > 0 ? h.getRange(2, 1, n, 1).getValues() : [];
    const i = ids.findIndex(r => String(r[0]) === id);
    if (i < 0) throw new Error('no existe esa foto');
    h.getRange(i + 2, 5).setValue(nuevo);
    h.getRange(i + 2, 7).setValue(nuevo === 'pendiente' ? '' : Date.now());
    return { ok: true };
  });
}

function hoja() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('PLANILLA')).getSheetByName('fotos');
}

function conLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function responder(x) {
  return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
}
