<!--
Copyright (c) The LHTML team
See LICENSE for details.
-->

[![Build Status](https://travis-ci.org/iffy/lhtml.svg?branch=master)](https://travis-ci.org/iffy/lhtml)

# LHTML

An LHTML file is a packaged web application with the ability to save itself.  Think PDFs but with web technologies.  For a demo, [watch this video](https://www.youtube.com/watch?v=QiAbkCHHefo):

[![LHTML Demo](https://img.youtube.com/vi/QiAbkCHHefo/0.jpg)](https://www.youtube.com/watch?v=QiAbkCHHefo)


**The current application is considered Alpha-quality.  Use at your own risk, and all that.**

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

### `defaultSaver`

This is the saving function used by default (if none is provided by calling `registerSaver`).  It will take the current state of `index.html` and overwrite `index.html` within the LHTML zip.

For usage, see `registerSaver`'s usage.

### `disableFormSaving()`

A common use case for LHTML files is to email a form to be filled out.  By default data entered into forms will be saved.  If you want to disable this (because you're using a framework like React or Angular) call `disableFormSaving()`.

Usage:

```html
<body>
    <!-- disable form saving -->
    <script>window.LHTML && LHTML.disableFormSaving();</script>
    Name: <input name="name">
    Email: <input type="email" name="email">
    Favorite color: <select>
        <option>Red</option>
        <option>Blue</option>
    </select>
</body>
```

### `on(event, handler)`

Listen for one of these events:

- `saved` - emitted after the document has been saved.  The handler is called with no arguments.

Usage:

```javascript
window.LHTML && LHTML.on('saved', function() {
    console.log('The file was saved!');
})
```

### `registerSaver(func)`

Registers a function to be called when the application is to be saved.  By default `LHTML.defaultSaver` is used.

Usage:

```html
<script>
// Register a saver that will save index.html in its current state
// and write some data to somedata.json within the LHTML zip.
window.LHTML && LHTML.registerSaver(function() {
    var files = LHTML.defaultSaver();
    files['somedata.json'] = '{"foo": "bar"}';
    return files;
})
</script>
```

### `save()`

Saves the current file.  See `registerSaver` for more info.

Usage:

```html
<script>
window.LHTML && LHTML.save().then(function() {
    console.log('saved');
})
</script>
```

### `setDocumentEdited(value)`

If form-saving is enabled (which it is by default and unless `disableFormSaving()` is called) then document edited state is handled automatically.  This function is mostly useful for documents with form-saving disabled.

Calling this function sets the edited state of the current document.  Before closing an edited document, the application will prompt to save.  Set this to `true` to prevent closing without a prompt.  Set to `false` if there are no changes to be saved.

Also, every time a document is saved, the edited state is automatically reset to `false`.

Usage:

```html
<script>
window.LHTML && LHTML.setDocumentEdited(true);
</script>
```

### `suggestSize(width, height)`

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

Insecurish things:

- Currently, LHTML files are unzipped to a temporary directory, then zipped back up to overwrite the original.  If an attacker sneaked something into that temporary directory, it would end up back in the zipped LHTML.

# Development

To run the application in development mode do:

    npm install
    node_modules/.bin/electron .

# Packaging

To package the application, do:

    npm install
    ./build.sh mac
    ./build.sh linux

