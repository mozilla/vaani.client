[![Build Status](https://travis-ci.org/mozilla/vaani.client.svg?branch=master)](https://travis-ci.org/mozilla/vaani.client)

Vaani client
------------

This is the front-end application for the Mozilla's Connected Devices project [Vaani local](https://wiki.mozilla.org/Vaani).

Prerequisites
-----------
In order to run this software, you need to have a number of packages,
including node and a custom version of pocketsphinx installed. There
is a script in the repo that will install and build the software you
need on a Raspberry Pi.

- Linux or OSX based system
- nodejs >= 4.2.x
- [sox] (http://sox.sourceforge.net/)
- Mozilla's custom [sphinxbase](https://github.com/mozilla/sphinxbase) and [pocketsphinx](https://github.com/mozilla/pocketsphinx)
- You'll need a Vaani server running. If you don't have an IP address to one, you can install [Vaani server](https://github.com/mozilla/vaani.server) and run it locally. Just make sure to update the right ip [here](https://github.com/mozilla/vaani.client/blob/master/index.js#L19)

Installation
-----------
Before starting to install this software, it might be a good idea to
make sure your system is up to date. On a Raspberry Pi, you can do
that with these commands:

```
$ sudo apt-get update
$ sudo apt-get dist-upgrade
$ sudo reboot
```

First, clone this repo:

```
$ git clone https://github.com/mozilla/vaani.client
```

Before you can use the code in the repo, you must install the software
it requires. On Raspberry Pi, some of this software needs to be built
from source, and this can take an hour or more. Running the following
script should download and install all of the software you
need. (Though to be on the safe side you might want to paste the code
from the script into your terminal one line at a time to make sure it
all works correctly on your system.)

```
$ vaani.client/bootstrap-scripts/raspberry-pi-setup.sh
```

Now that you have the system prerequsites installed, you can install
the direct dependencies for this repo.

```
$ cd vaani.client
$ npm install
```

Note that the `npm install` step will fail if you have not first
installed the prerequsites.

Setting up your Microphone
--------------------------

If you're using a USB microphone on Raspberry Pi, you'll need to make
sure that ALSA is configured correctly to use your microphone. This
may be as simple as running this command:

```
sudo cp config-files/asound.conf /etc
```

Of course, if you have an existing `asound.conf` file, you should back
it up first. You can test your microphone with:

```
$ arecord -f cd /tmp/test.wav  # record something, then Ctrl-C to quit
$ aplay /tmp/test.wav          # can you hear what you recorded?
```

If the volume of your recorded sound is low, you can adjust the
microphone gain with:

```
alsamixer -c 1
```

The `config.json` File
----------------------

The Vaani client reads credentials and other configuration information
from a file named `config.json` when it starts up. You must create
this file before you can run the program. Start by copying the
template file:

```
$ cp config.json.template config.json
```

Then edit config.json as needed. In particular, you must specify the
URL and password for the Vaani server you are using. For testing, you
also need to specify an Evernote developer token in this file. (When
you deploy, however, you'll want to run Vaani with the user's Evernote
OAUTH token in the environment variable EVERNOTE_OAUTH_TOKEN. More on
this topic below.)

Starting and Stopping Vaani
----------

To run the Vaani client once, just to try it out:

```
$ node index.js
```

If the program exits shortly after startup, it may mean that
your microphone is not configured correctly.

Stop it just by typing Ctrl-C

If you want Vaani to be managed by systemd, first copy the service file into
`/lib/systemd/system/`:

```
$ sudo cp config-files/vaani.service /lib/systemd/system
$ sudo mkdir /lib/systemd/system/vaani.service.d
```

Once the service file is installed, you can start and stop Vaani with
these commands:

```
$ sudo systemctl start vaani
$ sudo systemctl stop vaani
```

If you start Vaani this way, the program output is logged. You can
view the logs with:

```
$ sudo journalctl -b -u vaani
```

If you want Vaani to run automatically every time the system boots,
use this command to enable the service:

```
$ sudo systemctl enable vaani
```

Instead of enabling Vaani directly, however, you may prefer to run the
Vaani setup server when the system boots and rely on it to start Vaani
once it has ensured that the device has a working wifi connection. See
the vaani.setup repo at https://github.com/mozilla/vaani.setup

The vaani.setup service will obtain the user's OAUTH token and use it
as the value of the EVERNOTE_OAUTH_TOKEN environment variable in in
/lib/systemd/system/vaani.setup.d/evernote.conf so that Vaani is
started with a working oauth token.
