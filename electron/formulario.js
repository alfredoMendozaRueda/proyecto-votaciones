// Ventana para enviar una candidatura en la web de la empresa: se abre la
// oferta y, en cada página que cargue (y unos segundos después, por si el
// formulario aparece tarde), se rellenan los campos vacíos con tus datos, el
// CV y la carta. Nunca se pulsa «Enviar»: eso lo haces tú tras revisarlo.
import { BrowserWindow, shell } from 'electron';
import { rellenarFormulario } from '../src/compartido/rellenar.js';

const URL_HTTPS = /^https:\/\/[^\s]+$/i;

export function abrirFormulario({ url, datos, alCerrar = () => {}, padre = null }) {
  if (!URL_HTTPS.test(String(url ?? ''))) throw new Error('La oferta no tiene una dirección web válida.');
  const ventana = new BrowserWindow({
    width: 1120,
    height: 860,
    title: 'Kitsune · Candidatura',
    autoHideMenuBar: true,
    parent: padre ?? undefined,
    webPreferences: {
      // Sesión aparte: las webs de empleo no ven nada de Kitsune (y Kitsune no guarda sus cookies con las suyas).
      partition: 'persist:kitsune-candidaturas',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const script = `(${rellenarFormulario.toString()})(${JSON.stringify(datos)})`;
  let repeticiones = null;

  // En la página y en sus marcos (muchos formularios van dentro de un iframe).
  const rellenarTodo = () => {
    if (ventana.isDestroyed()) return;
    for (const marco of ventana.webContents.mainFrame.framesInSubtree) {
      marco.executeJavaScript(script).catch(() => {});
    }
  };
  const tandas = () => {
    clearInterval(repeticiones);
    let veces = 0;
    rellenarTodo();
    repeticiones = setInterval(() => {
      rellenarTodo();
      if (++veces >= 12) clearInterval(repeticiones);
    }, 1500);
  };
  ventana.webContents.on('did-finish-load', tandas);
  ventana.webContents.on('did-navigate-in-page', tandas);
  // «Solicitar» suele abrir otra pestaña: se carga en esta misma ventana.
  ventana.webContents.setWindowOpenHandler(({ url: destino }) => {
    if (URL_HTTPS.test(destino)) ventana.loadURL(destino);
    return { action: 'deny' };
  });
  // Nada de abrir programas ni archivos locales desde la web.
  ventana.webContents.on('will-navigate', (evento, destino) => {
    if (!/^https?:\/\//i.test(destino)) {
      evento.preventDefault();
      if (/^mailto:/i.test(destino)) shell.openExternal(destino);
    }
  });
  ventana.on('closed', () => {
    clearInterval(repeticiones);
    alCerrar();
  });
  ventana.loadURL(url);
  return ventana;
}
