# Código de terceros

## ai-job-search

`src/compartido/portales.js` adapta los buscadores de portales de empleo de
[ai-job-search](https://github.com/MadsLorentzen/ai-job-search)
(`.agents/skills/linkedin-search` y `.agents/skills/freehire-search`), y
`src/compartido/empleo.js` sigue su método de evaluación, redacción, revisión,
comprobación ATS y preparación de entrevistas.

```
MIT License

Copyright (c) 2026 Mads Lorentzen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## VoiceStudio

Kitsune para Windows puede usar la API local de
[VoiceStudio](https://github.com/debpalash/VoiceStudio) (AGPL-3.0) si está
instalado en el ordenador. Kitsune no incluye código de VoiceStudio: solo le
hace peticiones HTTP en `127.0.0.1`.
