"""Logging + crash capture.

Logs go to a rotating file under ``%APPDATA%\\MovieShelf\\logs`` so that crashes and
test runs leave a durable record even when the app is launched as a windowed exe
(which has no console). Uncaught exceptions — including the ones PyQt raises from
slots before it aborts — are written to the log via a global excepthook.
"""

import logging
import sys
import traceback
from logging.handlers import RotatingFileHandler

from .config import log_dir

LOG_NAME = 'movieshelf.log'
_log = logging.getLogger('movieshelf')


def setup_logging(level=logging.INFO):
    """Configure file logging and return the active log file path."""
    log_path = log_dir() / LOG_NAME
    root = logging.getLogger()
    root.setLevel(level)
    already = any(
        isinstance(h, RotatingFileHandler) and getattr(h, '_movieshelf', False)
        for h in root.handlers
    )
    if not already:
        handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=5, encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)-7s %(name)s: %(message)s'))
        handler._movieshelf = True
        root.addHandler(handler)
        if sys.stderr is not None:  # also echo to console when run from source
            stream = logging.StreamHandler()
            stream.setFormatter(logging.Formatter('%(levelname)-7s %(name)s: %(message)s'))
            root.addHandler(stream)
    return log_path


def install_excepthook():
    """Log any uncaught exception before the default handler runs."""
    previous = sys.excepthook

    def handler(exc_type, exc, tb):
        _log.critical('Uncaught exception:\n%s', ''.join(traceback.format_exception(exc_type, exc, tb)))
        previous(exc_type, exc, tb)

    sys.excepthook = handler
