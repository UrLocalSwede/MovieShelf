"""Persistence of saved library folders in a user-writable location."""

import os
from pathlib import Path

from .config import DEFAULT_FOLDERS, MOVIES_DIR, user_config_dir


def _settings_path() -> Path:
    path = user_config_dir() / 'settings.txt'
    _migrate_legacy_settings(path)
    return path


def _migrate_legacy_settings(new_path: Path) -> None:
    """Carry over folders saved by older versions that stored settings next to the code."""
    if new_path.exists():
        return
    legacy = Path(__file__).resolve().parents[2] / 'settings.txt'
    if legacy.exists():
        try:
            new_path.write_text(legacy.read_text(encoding='utf-8'), encoding='utf-8')
        except OSError:
            pass


def _existing_defaults():
    return [folder for folder in DEFAULT_FOLDERS if os.path.isdir(folder)] or DEFAULT_FOLDERS


def save_folders(folders, current_folder=''):
    unique = []
    for folder in folders:
        if folder and os.path.isdir(folder) and folder not in unique:
            unique.append(folder)
    if current_folder and os.path.isdir(current_folder) and current_folder not in unique:
        unique.insert(0, current_folder)
    _settings_path().write_text('\n'.join(unique), encoding='utf-8')


def load_saved_folders():
    settings_path = _settings_path()
    if not settings_path.exists():
        return _existing_defaults()
    folders = [line.strip() for line in settings_path.read_text(encoding='utf-8').splitlines() if line.strip()]
    valid = [folder for folder in folders if os.path.isdir(folder)]
    return valid or _existing_defaults()


def load_folder() -> str:
    folders = load_saved_folders()
    return folders[0] if folders else MOVIES_DIR
