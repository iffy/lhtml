<!--
Copyright (c) The LHTML team
See LICENSE for details.
-->

[![Build Status](https://travis-ci.org/iffy/lhtml.svg?branch=master)](https://travis-ci.org/iffy/lhtml)

- [LHTML document author API documentation](api.md)

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

LHTML viewers provide a small JavaScript API to `index.html` files within the `LHTML` object.  Available endpoints are described in [api.md](api.md).

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

You can set the process and browser logging levels with the `LOGLEVEL` and `JS_LOGLEVEL` environment variables.

    LOGLEVEL=warn JS_LOGLEVEL=debug electron .

# Packaging

To do cross-platform builds, see [this guide](https://github.com/electron-userland/electron-builder/wiki/Multi-Platform-Build)

To package the application, do one of these:

    build --win --mac --linux --ia32 --x64

You can omit whichever arch/platform you don't need to build.

# Releases

To manually create a draft release, you'll need a `GH_TOKEN` with `repo` scope access.  Generate one on GitHub (in Settings somewhere).  Once you have the token do:

    GH_TOKEN="..." dev/publish/publish.sh

Update `CHANGELOG.md` with:

    dev/publish/updatechangelog.sh

