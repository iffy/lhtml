<a name="LHTML"></a>

## LHTML : <code>object</code>
LHTML namespace.

**Kind**: global namespace  

* [LHTML](#LHTML) : <code>object</code>
    * [.saving](#LHTML.saving) : <code>object</code>
        * [.defaultSaver()](#LHTML.saving.defaultSaver) ⇒ <code>Object</code>
        * [.registerSaver(func)](#LHTML.saving.registerSaver)
        * [.save()](#LHTML.saving.save) ⇒ <code>Promise</code>
        * [.setDocumentEdited(edited)](#LHTML.saving.setDocumentEdited)
        * [.disableFormSaving()](#LHTML.saving.disableFormSaving)
    * [.on(event, handler)](#LHTML.on)

<a name="LHTML.saving"></a>

### LHTML.saving : <code>object</code>
Saving-related functions.  See also [LHTML.fs](LHTML.fs).

**Kind**: static namespace of <code>[LHTML](#LHTML)</code>  

* [.saving](#LHTML.saving) : <code>object</code>
    * [.defaultSaver()](#LHTML.saving.defaultSaver) ⇒ <code>Object</code>
    * [.registerSaver(func)](#LHTML.saving.registerSaver)
    * [.save()](#LHTML.saving.save) ⇒ <code>Promise</code>
    * [.setDocumentEdited(edited)](#LHTML.saving.setDocumentEdited)
    * [.disableFormSaving()](#LHTML.saving.disableFormSaving)

<a name="LHTML.saving.defaultSaver"></a>

#### saving.defaultSaver() ⇒ <code>Object</code>
This is the saving function used by default (if none is provided by calling
[registerSaver](#LHTML.saving.registerSaver)). It will take the current state of
`index.html` and overwrite `index.html` within the LHTML zip.


For usage, see [registerSaver](#LHTML.saving.registerSaver)'s usage.

**Kind**: static method of <code>[saving](#LHTML.saving)</code>  
**Returns**: <code>Object</code> - an object conforming to what {@link
                      LHTML.saving.registerSaver} expects.  
<a name="LHTML.saving.registerSaver"></a>

#### saving.registerSaver(func)
Registers a function to be called when the application is to be saved.  By default [defaultSaver](#LHTML.saving.defaultSaver) is used.

The registered function is expected to return on object whose keys are filenames and whose values are file contents.

**Kind**: static method of <code>[saving](#LHTML.saving)</code>  

| Param | Type | Description |
| --- | --- | --- |
| func | <code>function</code> | The function that will be called on save. |

**Example**  
```js
// Register a saver that will save index.html in its current state
// and write some data to somedata.json within the LHTML zip.
window.LHTML && LHTML.saving.registerSaver(function() {
 var files = LHTML.saving.defaultSaver();
 files['somedata.json'] = '{"foo": "bar"}';
 return files;
})
```
<a name="LHTML.saving.save"></a>

#### saving.save() ⇒ <code>Promise</code>
Initiate a save of the current file.

**Kind**: static method of <code>[saving](#LHTML.saving)</code>  
**Returns**: <code>Promise</code> - A promise that will fire once the document has been
                       successfully saved.  
<a name="LHTML.saving.setDocumentEdited"></a>

#### saving.setDocumentEdited(edited)
Indicate that the document has unsaved changes.

If form-saving is enabled (which it is by default)
then document edited state is handled automatically.
This function is mostly useful for documents with
form-saving disabled.

Calling this function sets the edited state
of the current document.  Before closing an edited document,
the application will prompt the user to save.

Call this with `true` to prevent closing without a prompt.
Call this with `false` if there are no changes to be saved.

Also, every time a document is saved, the edited state is automatically reset to `false`.

**Kind**: static method of <code>[saving](#LHTML.saving)</code>  

| Param | Type | Description |
| --- | --- | --- |
| edited | <code>boolean</code> | Status to set |

**Example**  
```js
<script>
  window.LHTML && LHTML.saving.setDocumentEdited(true);
</script>
```
<a name="LHTML.saving.disableFormSaving"></a>

#### saving.disableFormSaving()
Disables form saving.

A common use case for LHTML files is to present an HTML form.  Therefore, by
default data entered into forms will be saved.  If you want to disable this
auto-saving (because you're using a framework like React or Angular) call
[LHTML.saving.disableFormSaving()](LHTML.saving.disableFormSaving()).

**Kind**: static method of <code>[saving](#LHTML.saving)</code>  
**Example**  
```js
<body>
    <!-- disable form saving -->
    <script>window.LHTML && LHTML.saving.disableFormSaving();</script>
    Name: <input name="name">
    Email: <input type="email" name="email">
    Favorite color: <select>
        <option>Red</option>
        <option>Blue</option>
    </select>
</body>
```
<a name="LHTML.on"></a>

### LHTML.on(event, handler)
Listen for LHTML events.

Possible events are:

| Event | Description |
|---|---|
| `saved` | Emitted after the document has been saved.  Handler is called with no arguments. |
| `save-failed` | Emitted if an attempted save fails.  The handler is called with a string description. |

**Kind**: static method of <code>[LHTML](#LHTML)</code>  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>string</code> | Event name.  Will be one of: <tt>saved</tt>,                                  <tt>save-failed</tt> |
| handler | <code>function</code> | Function that will be called with the event. |

**Example**  
```js
window.LHTML && LHTML.on('saved', function() {
    console.log('The file was saved!');
})
window.LHTML && LHTML.on('save-failed', function() {
    console.log('Save failed :(');
})
```
