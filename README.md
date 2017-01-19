<!--
Copyright (c) The LHTML team
See LICENSE for details.
-->

# LHTML

An LHTML file is a packaged web application with the ability to save itself.  Think PDFs but with web technologies.  For a demo, watch this video:

XXX

**The current application is considered Alpha-quality**

# Making LHTML files

To create an LHTML file, create an `index.html` file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My LHTML file</title>
</head>
<body>
    Hello
</body>
</html>
```

then zip it up.  On Linux/macOS do:

```bash
zip myfirst.lhtml index.html
```

Now you can open the file, save it, email it, copy it, etc...  But this sample file isn't editable.  To make an editable file, see [`enableFormSaving`](#enableformsaving).

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

### `enableFormSaving()`

A common use case for LHTML files is to email a form to be filled out.  If you don't want to use a fancy framework (like React or Angular) you can call this function to enable basic HTML form saving.

On documents where this is called, inputs will retain their values when saved.

Usage:

```html
<body>
    <script>window.LHTML && LHTML.enableFormSaving()</script>
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


# Why not just use Electron?

This LHTML viewer is built with Electron, so I obviously think Electron is a good choice for making apps.  And it may make more sense for you to use Electron if you need full filesystem access, network access or any of the other features Electron provides.

But if you're making documents (or document-like things), you don't want to build and install an entirely new Electron app for each document.


# Development

To run the application in development mode do:

    npm install
    node_modules/.bin/electron .

# Packaging

To package the application, do:

    npm install
    ./build.sh mac
    ./build.sh linux

