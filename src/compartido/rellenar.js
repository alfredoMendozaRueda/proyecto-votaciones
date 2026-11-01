// Rellena el formulario de candidatura de una empresa (Greenhouse, Lever,
// Workable, Teamtailor, Ashby, SmartRecruiters…) con tus datos, el CV y la
// carta. Se ejecuta DENTRO de esa página (Kitsune para Windows la abre en una
// ventana aparte): solo rellena campos vacíos, nunca pulsa «Enviar» y deja un
// aviso para que revises todo. Tiene que ser autocontenida (se inyecta como texto).

export function rellenarFormulario(datos) {
  const hechos = [];
  const bajo = (t) =>
    String(t ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  const visible = (el) => el.type === 'file' || Boolean(el.offsetParent || el.getClientRects().length);

  // Todo lo que describe un campo: nombre, id, placeholder, etiqueta y título del grupo.
  function descripcion(el) {
    const partes = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('autocomplete'), el.getAttribute('data-qa'), el.getAttribute('data-testid')];
    if (el.id) partes.push(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent);
    partes.push(el.closest('label')?.textContent);
    const ref = el.getAttribute('aria-labelledby');
    if (ref) for (const id of ref.split(/\s+/)) partes.push(document.getElementById(id)?.textContent);
    const grupo = el.closest('.field, .application-question, .form-group, fieldset, [class*="field" i], [class*="question" i]');
    if (grupo) partes.push(grupo.querySelector('label, legend, .label, .application-label, [class*="label" i]')?.textContent);
    return bajo(partes.filter(Boolean).join(' | '));
  }

  function marcar(el) {
    el.style.outline = '2px solid #e0533f';
    el.style.outlineOffset = '2px';
  }

  // Valor a través del setter nativo: así React, Vue y compañía se enteran.
  function poner(el, valor, que) {
    if (!valor || el.value || el.disabled || el.readOnly) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    for (const tipo of ['input', 'change', 'blur']) el.dispatchEvent(new Event(tipo, { bubbles: true }));
    marcar(el);
    hechos.push(que);
    return true;
  }

  const REGLAS = [
    [/last.?name|surname|family.?name|apellido|lname/, 'apellidos', 'Apellidos'],
    [/first.?name|given.?name|fname|(^|\W)nombre(?!.*(complet|empresa|compan|usuario))/, 'nombre', 'Nombre'],
    [/full.?name|nombre complet|your name|tu nombre|(^|\|)\s*name\s*($|\||\*)/, 'nombreCompleto', 'Nombre completo'],
    [/e-?mail|correo/, 'email', 'Correo'],
    [/phone|telefono|movil|mobile|celular/, 'telefono', 'Teléfono'],
    [/linkedin/, 'linkedin', 'LinkedIn'],
    [/github/, 'github', 'GitHub'],
    [/website|portfolio|portafolio|web personal|sitio web|personal url|blog/, 'web', 'Web'],
    [/\bcity\b|ciudad|location|ubicacion|localidad|poblacion|current location/, 'ubicacion', 'Ubicación'],
  ];

  const campos = document.querySelectorAll(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]):not([type=search]), textarea',
  );
  for (const el of campos) {
    if (!visible(el)) continue;
    const d = descripcion(el);
    if (el.tagName === 'TEXTAREA') {
      if (/cover|carta|motivac|motivation|presentacion|why do you|por que|additional information|informacion adicional/.test(d)) poner(el, datos.carta, 'Carta');
      continue;
    }
    if (el.type === 'email') {
      poner(el, datos.email, 'Correo');
      continue;
    }
    if (el.type === 'tel') {
      poner(el, datos.telefono, 'Teléfono');
      continue;
    }
    if (el.name === 'name' || el.getAttribute('autocomplete') === 'name') {
      poner(el, datos.nombreCompleto, 'Nombre completo');
      continue;
    }
    for (const [regla, clave, que] of REGLAS) {
      if (regla.test(d)) {
        poner(el, datos[clave], que);
        break;
      }
    }
  }

  // Archivos: el CV donde pide currículum y la carta donde pide carta.
  const aArchivo = (b64, nombre) => new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], nombre, { type: 'application/pdf' });
  function adjuntar(el, b64, nombre, que) {
    if (!b64 || el.files?.length || el.disabled) return false;
    const dt = new DataTransfer();
    dt.items.add(aArchivo(b64, nombre));
    el.files = dt.files;
    for (const tipo of ['input', 'change']) el.dispatchEvent(new Event(tipo, { bubbles: true }));
    marcar(el.closest('label, .field, [class*="upload" i]') ?? el);
    hechos.push(que);
    return true;
  }
  const archivos = [...document.querySelectorAll('input[type=file]')];
  let cvPuesto = false;
  for (const el of archivos) {
    const d = descripcion(el);
    if (/cover|carta|motivation|motivacion/.test(d)) adjuntar(el, datos.cartaPdf, datos.nombreCarta, 'Carta (PDF)');
    else if (!cvPuesto && /resume|\bcv\b|curricul|attach|adjunt|upload|subir|documento/.test(d)) cvPuesto = adjuntar(el, datos.cvPdf, datos.nombreCv, 'CV (PDF)');
  }
  if (!cvPuesto && archivos.length === 1 && !archivos[0].files?.length) adjuntar(archivos[0], datos.cvPdf, datos.nombreCv, 'CV (PDF)');

  // Aviso fijo: qué se ha rellenado y que el envío es cosa tuya.
  if (hechos.length) {
    let aviso = document.getElementById('kitsune-aviso');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.id = 'kitsune-aviso';
      aviso.setAttribute('role', 'status');
      aviso.style.cssText =
        'position:fixed;z-index:2147483647;left:50%;bottom:18px;transform:translateX(-50%);max-width:min(560px,92vw);padding:12px 16px;' +
        'border-radius:12px;background:#1d1311;color:#f4ebe6;font:14px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid #6e2a20';
      document.body.append(aviso);
    }
    const anteriores = (aviso.dataset.hechos ?? '').split('|').filter(Boolean);
    const todos = [...new Set([...anteriores, ...hechos])];
    aviso.dataset.hechos = todos.join('|');
    aviso.textContent = `狐 Kitsune ha rellenado: ${todos.join(', ')}. Revisa cada campo, completa lo que falte y pulsa tú «Enviar».`;
  }
  return { hechos };
}

// Los datos que necesita, a partir del CV adaptado y los PDF.
export function datosParaFormulario(cv, { carta = '', cvPdf = '', cartaPdf = '', nombreCv = 'CV.pdf', nombreCarta = 'Carta.pdf' } = {}) {
  const [nombre, ...resto] = String(cv.nombre ?? '').trim().split(/\s+/);
  const enlaces = cv.enlaces ?? [];
  const conProtocolo = (u) => (u && !/^https?:\/\//.test(u) ? `https://${u}` : u ?? '');
  return {
    nombre: nombre ?? '',
    apellidos: resto.join(' '),
    nombreCompleto: String(cv.nombre ?? '').trim(),
    email: cv.email ?? '',
    telefono: cv.telefono ?? '',
    ubicacion: cv.ubicacion ?? '',
    linkedin: conProtocolo(enlaces.find((e) => /linkedin\./i.test(e))),
    github: conProtocolo(enlaces.find((e) => /github\./i.test(e))),
    web: conProtocolo(enlaces.find((e) => !/linkedin\.|github\./i.test(e))),
    carta,
    cvPdf,
    cartaPdf,
    nombreCv,
    nombreCarta,
  };
}
