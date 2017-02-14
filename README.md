<!--
Copyright (c) The LHTML team
See LICENSE for details.
-->

[![Build Status](https://travis-ci.org/iffy/lhtml.svg?branch=master)](https://travis-ci.org/iffy/lhtml)

# LHTML <img src="doc/icon.png" width="26">

An LHTML file is a packaged web application with the ability to save itself.  Think PDFs but with web technologies.  For a demo, [watch this video](https://www.youtube.com/watch?v=QiAbkCHHefo):

[![LHTML Demo](https://img.youtube.com/vi/QiAbkCHHefo/0.jpg)](https://www.youtube.com/watch?v=QiAbkCHHefo)


**The current application is considered Alpha-quality.  Use at your own risk, and all that.**

# Installation

- [Download the latest](https://github.com/iffy/lhtml/releases)
- Or clone this repo and [build from source](#packaging)
- Or clone this repo and follow the [development instructions](#development)

# Making LHTML files

To create an LHTML file, create an `index.html` file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My LHTML file</title>
</head>
<body>
    Name: <input type="text">
</body>
</html>
```

then zip it up.  On Linux/macOS do:

```bash
zip myfirst.lhtml index.html
```

Now you can open the file, type in the inputs, save it, email it, copy it, etc...

## Resources

If you want to include CSS or JavaScript files, include them in the zip and reference them with relative paths.  For example:

```html
<head>
  <link type="text/css" rel="stylesheet" href="style.css" media="screen,projection">
  ...
</head>
...
```

```bash
zip myfirst.lhtml index.html style.css
```

## External Resources

LHTML files are not allowed to access resources over the network.  This is intentional for security reasons.

## API

LHTML viewers provide a small JavaScript API to `index.html` files within the `LHTML` object.  Available endpoints are described here:

| Function/Variable | Short description |
|---|---|
| [`fs.listdir()`](#fslistdir) | List contents of the zip |
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

### `fs.listdir()`

List the full contents of the LHTML zip file.  Returns a list of objects with the following members:

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

Read an entire file's contents into a string.

Usage:

```javascript
window.LHTML && LHTML.fs.readFile('something.txt').then(function(contents) {
    console.log('something.txt contains:');
    console.log(contents);
})
```

### `fs.remove(...)`

Delete a file/directory from the zipfile.  **You must call `saving.save()` afterward if you want the deletion to be permanent.**

Usage:

```javascript
window.LHTML && LHTML.fs.remove('foo.txt').then(function() {
    return LHTML.save();
})
```

### `fs.writeFile(...)`

Overwrite a file, creating it if necessary.  Also, any subdirectories needed will be created.  **You must call `saving.save()` afterward if you want the writing to be permanent.**

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
- `error` - emitted for certain errors.  Comes with a `message` property.

Usage:

```javascript
window.LHTML && LHTML.on('saved', function() {
    console.log('The file was saved!');
})
window.LHTML && LHTML.on('error', function(err) {
    console.log('Error encountered:', err.message);
})
```

### `saving.defaultSaver`

This is the saving function used by default (if none is provided by calling `saving.registerSaver`).  It will take the current state of `index.html` and overwrite `index.html` within the LHTML zip.

For usage, see `saving.registerSaver`'s usage.

### `saving.disableFormSaving()`

A common use case for LHTML files is to email a form to be filled out.  By default data entered into forms will be saved.  If you want to disable this (because you're using a framework like React or Angular) call `saving.disableFormSaving()`.

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


# Why not just use Electron?

This LHTML viewer is built with Electron, so I obviously think Electron is a good choice for making apps.  And it may make more sense for you to use Electron if you need full filesystem access, network access or any of the other features Electron provides.

But if you're making documents (or document-like things), you don't want to build and install an entirely new Electron app for each document.

# How secure is this?

Security of LHTML hasn't yet been fully vetted.  Some precautions have been taken, but we should do a full security audit before you open Internet-stranger's LHTML files.  Here's what we do:

- All documents are loaded in a sandboxed [`<webview>` tag](http://electron.atom.io/docs/api/web-view-tag/)
- Documents have no access to node stuff (if the sandbox of `<webview>` is working as designed)
- Access to `file://` resources is forbidden to documents.
- Access to `https?://` resources is forbidden to documents.
- Documents shouldn't be able to open new windows (need to verify this for all cases), so they can't open fake system dialogs, hopefully.
- Documents are limited in size (currently hard-coded at 10MB, but with plans to make it configurable) to prevent documents from filling up hard drives

Insecurish things:

- Currently, LHTML files are unzipped to a temporary directory, then zipped back up to overwrite the original.  If an attacker sneaked something into that temporary directory, it would end up back in the zipped LHTML.

# Development

To run the application in development mode do:

    yarn install
    node_modules/.bin/electron .

# Packaging

To do cross-platform builds, see [this guide](https://github.com/electron-userland/electron-builder/wiki/Multi-Platform-Build)

To package the application, do one of these:

    build --win --mac --linux --ia32 --x64

You can omit whichever arch/platform you don't need to build.

# Releases

To manually create a draft release, you'll need a `GH_TOKEN` with `repo` scope access.  Generate one on GitHub (in Settings somewhere).  Once you have the token do:

    GH_TOKEN="..." build --win --mac --linux --ia32 --x64 --draft -p always

