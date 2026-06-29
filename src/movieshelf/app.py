"""Application entry point — launches the pywebview window."""

import logging

import webview

from . import __version__
from .api import Api
from .config import web_dir
from .logsetup import install_excepthook, setup_logging


def main():
    log_path = setup_logging()
    install_excepthook()
    log = logging.getLogger('movieshelf')
    log.info('MovieShelf %s starting (logs: %s)', __version__, log_path)

    # Diagnostic: confirm the optional native/data-backed libraries loaded (esp. when frozen).
    from . import fingerprint, parsing, player
    log.info('Capabilities: guessit=%s mediainfo=%s mpv=%s',
             parsing._HAS_GUESSIT, fingerprint._HAS_MEDIAINFO, player.has_mpv())

    api = Api()
    window = webview.create_window(
        'MovieShelf',
        url=str(web_dir() / 'index.html'),
        js_api=api,
        width=1280,
        height=820,
        min_size=(1024, 700),
        background_color='#100e11',
    )
    window.events.closed += player.shutdown  # tear down the mpv core on exit

    webview.start()
    log.info('MovieShelf exiting')


if __name__ == '__main__':
    main()
