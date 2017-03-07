<a name="LHTML"></a>

## LHTML : <code>object</code>
LHTML namespace.

**Kind**: global namespace  

* [LHTML](#LHTML) : <code>object</code>
    * [.saving](#LHTML.saving) : <code>object</code>
        * [.defaultSaver()](#LHTML.saving.defaultSaver) ⇒ <code>Object</code>
        * [.registerSaver(func)](#LHTML.saving.registerSaver)
        * [.save()](#LHTML.saving.save) ⇒ <code>Promise</code>
        * [.disableFormSaving()](#LHTML.saving.disableFormSaving)
    * [.on(event, handler)](#LHTML.on)

<a name="LHTML.saving"></a>

### LHTML.saving : <code>object</code>
LHTML.saving

**Kind**: static namespace of <code>[LHTML](#LHTML)</code>  

* [.saving](#LHTML.saving) : <code>object</code>
    * [.defaultSaver()](#LHTML.saving.defaultSaver) ⇒ <code>Object</code>
    * [.registerSaver(func)](#LHTML.saving.registerSaver)
    * [.save()](#LHTML.saving.save) ⇒ <code>Promise</code>
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
