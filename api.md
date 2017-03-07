# LHTML Document API

These are the functions available to authors of LHTML documents available in the `window.LHTML` namespace (as shown in the examples).

| Function/Variable | Short description |
|---|---|
| [`fs.listdir(...)`](#fslistdir) | List contents of the zip |
| [`fs.readFile(...)`](#fsreadfile) | Read a file from the document zip |
| [`fs.remove(...)`](#fsremove) | Remove a file/dir from the document zip |
| [`fs.writeFile(...)`](#fswritefile) | Overwrite a file within the document zip |
| [`on(...)`](#on) | Listen for events |
| [`saving.defaultSaver`](#savingdefaultsaver) | The function that will be used for saving if `registerSaver` isn't called |
| [`saving.disableFormSaving()`](#savingdisableformsaving) | Called to disable automatic form saving |
| [`saving.registerSaver(...)`](#savingregistersaver) | Register a function to determine how the document is saved |
| [`saving.save()`](#savingsave) | Programatically start saving the current document |
| [`saving.setDocumentEdited(...)`](#savingsetdocumentedited) | Indicate that there are changes to be saved |
| [`suggestSize(...)`](#suggestsize) | Attempt to resize the document's window |

### `fs.listdir(...)`

List the contents of the LHTML zip file.  If called without arguments, you will receive a list of every file within the LHTML zip file.

Spec: `fs.listdir([path,] [options])`

| Parameter | Description |
|---|---|
| `path` | Path (relative to document zip root) to list.  Defaults to `/` |
| `options` | Object of options |
| `options.recursive` | If `true` (the default) then recursively list the directory tree. |

Returns a list of objects with the following members:

| Key | Description |
|---|---|
| `name` | Base name of file/dir |
| `path` | Full relative path of file/dir |
| `dir` | Full relative path of containing dir |
| `size` | Size of file/dir in bytes |
| `isdir` | Optional.  `true` if this item is a directory, otherwise `undefined` |

Usage:

```javascript
window.LHTML && LHTML.fs.listdir().then(function(items) {
    items.foreach(function(item) {
        console.log(item.path + ': ' + item.size + 'B');
    });
});
```

### `fs.readFile(...)`

Same as [Node's `fs.readFile`](https://nodejs.org/api/fs.html#fs_fs_readfile_file_options_callback) except that it returns a Promise.

Read an entire file's contents.

Usage:

```javascript
window.LHTML && LHTML.fs.readFile('something.txt').then(function(contents) {
    console.log('something.txt contains:');
    console.log(contents);
})
```

### `fs.remove(...)`

Spec: `fs.remove(path)`

Delete a file/directory from the zipfile.

**You must call `saving.save()` afterward if you want the deletion to be permanent.**

Usage:

```javascript
window.LHTML && LHTML.fs.remove('foo.txt').then(function() {
    return LHTML.save();
})
```

### `fs.writeFile(...)`

Same as [Node's `fs.writeFile`](https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback) except:

- it returns a Promise
- if the directory of the file doesn't exist, it is created
- it limits the size of what you can write

**You must call `saving.save()` afterward if you want the writing to be permanent.**

Usage:

```javascript
window.LHTML && LHTML.fs.writeFile('foo.txt', 'guts').then(function() {
    return LHTML.save();
});
```

### `on(...)`

`on(event, handler)`

Listen for one of these events:

- `saved` - emitted after the document has been saved.  The handler is called with no arguments.
- `save-failed` - emitted if an attempted save fails.  The handler is called with a string description.

Usage:

```javascript
window.LHTML && LHTML.on('saved', function() {
    console.log('The file was saved!');
})
window.LHTML && LHTML.on('save-failed', function() {
    console.log('Save failed :(');
})
```

### `saving.defaultSaver`

This is the saving function used by default (if none is provided by calling `saving.registerSaver`).  It will take the current state of `index.html` and overwrite `index.html` within the LHTML zip.

For usage, see `saving.registerSaver`'s usage.

### `saving.disableFormSaving()`

A common use case for LHTML files is to present a form to be filled out.  Therefore, by default data entered into forms will be saved.  If you want to disable this automatic saving (because you're using a framework like React or Angular) call `saving.disableFormSaving()`.

Usage:

```html
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


### `saving.registerSaver(...)`

`saving.registerSaver(func)`

Registers a function to be called when the application is to be saved.  By default `saving.defaultSaver` is used.

The registered function is expected to return on object whose keys are filenames and whose values are file contents.

Usage:

```html
<script>
// Register a saver that will save index.html in its current state
// and write some data to somedata.json within the LHTML zip.
window.LHTML && LHTML.saving.registerSaver(function() {
    var files = LHTML.saving.defaultSaver();
    files['somedata.json'] = '{"foo": "bar"}';
    return files;
})
</script>
```

### `saving.save()`

Saves the current file.  See `saving.registerSaver` for more info.

Usage:

```html
<script>
window.LHTML && LHTML.saving.save().then(function() {
    console.log('saved');
})
</script>
```

### `saving.setDocumentEdited(...)`

`saving.setDocumentEdited(value)`

If form-saving is enabled (which it is by default and unless `saving.disableFormSaving()` is called) then document edited state is handled automatically.  This function is mostly useful for documents with form-saving disabled.

Calling this function sets the edited state of the current document.  Before closing an edited document, the application will prompt to save.  Set this to `true` to prevent closing without a prompt.  Set to `false` if there are no changes to be saved.

Also, every time a document is saved, the edited state is automatically reset to `false`.

Usage:

```html
<script>
window.LHTML && LHTML.saving.setDocumentEdited(true);
</script>
```

### `suggestSize(...)`

`suggestSize(width, height)`

Suggest that the document be the given size (in pixels).  It will promise an object with the actual width and height the window was resized to.  The resulting size will differ from the suggested size when the suggested size is too small or too large (as determined by the LHTML viewer).

Usage:

```html
<script>
window.LHTML && LHTML.suggestSize(500, 500).then(function(size) {
    console.log('resized to ' + size.width + ' by ' size.height);
});
</script>
```