# Action Studio entry files

- `index.template.html` and `action-studio.js` are the editable source entry points.
- `index.html` and `action-studio.bundle.js` are generated standalone files.
- Run `npm run build:action-studio` after changing `src/`, `action-studio.js` or the HTML template.

The generated `index.html` deliberately loads a classic script so it can be opened directly through `file://` without browser ES-module CORS errors. A local HTTP server remains supported but is no longer required for the checked-in demo.

