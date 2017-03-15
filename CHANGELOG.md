<!-- THIS FILE IS AUTOMATICALLY UPDATED. SEE THE README -->

## v0.5.0

- **BACKWARD INCOMPATIBLE:** Changes for the CHANGELOG are no longer sourced from git commit messages.

- **BACKWARD INCOMPATIBLE:** Removed `LHTML.saving.defaultSaver` in favor of `LHTML.saving.onBeforeSave`

- **BACKWARD INCOMPATIBLE:** Renamed `LHTML.saving.disableFormSaving` to `LHTML.saving.disableFormSync`

- **BACKWARD INCOMPATIBLE:** Removed `LHTML.saving.registerSaver` in favor of `LHTML.saving.onBeforeSave`

- **FIX:** When a document is reloaded, the document edited state is reset to false

- NEW: Changes for the CHANGELOG are now sourced from files rather than from git commit messages.

- NEW: Added safeguards to make sure the document and main process aren't trying to write/save at the same time

- NEW: Reduce logging noise

- NEW: Allow documents to access blob: URLs

- NEW: `writeFile`/`readFile` accept the same arguments as Node `fs` equivalents.

- NEW: There are working, functional tests of some saving/loading scenarios.

- NEW: `fs.listdir` now accepts path and `{recursive:false}` arguments.

- NEW: Added `saving.onBeforeSave` to replace duplicate methods of saving files

- NEW: Add 'Export As PDF...' menu item

- Moved API documentation out to `api.md`



## v0.4.0

- NEW:  Add 'New From Template...' menu option

- NEW:  Add Save As Template

- NEW:  menu items are enabled/disabled where pertinent

-  Reduce logging noise and roll log file

-  only send document-changed state when the state changes


### v0.3.5

- NEW:  Add system for updating CHANGELOG.md from git log


