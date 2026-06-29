# -*- mode: python ; coding: utf-8 -*-
import os

from PyInstaller.utils.hooks import collect_all

# SPECPATH is the directory containing this file (build/); the project root is its parent.
ROOT = os.path.dirname(SPECPATH)
SRC = os.path.join(ROOT, 'src')
ASSETS = os.path.join(ROOT, 'assets')
WEB = os.path.join(SRC, 'movieshelf', 'web')

# guessit (+ rebulk/babelfish) and pymediainfo ship data files / native libs that must be bundled.
datas = [
    (os.path.join(ASSETS, 'movie_icon.png'), 'assets'),
    (WEB, 'web'),
]
binaries = [
    # Bundled mpv engine — placed at the bundle root where python-mpv finds it via PATH.
    (os.path.join(ROOT, 'vendor', 'libmpv', 'libmpv-2.dll'), '.'),
]
hiddenimports = []
for pkg in ('guessit', 'rebulk', 'babelfish', 'pymediainfo'):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden


a = Analysis(
    [os.path.join(SRC, 'movieshelf', '__main__.py')],
    pathex=[SRC],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports + ['webview.platforms.winforms'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MovieShelf',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=[os.path.join(ASSETS, 'movie_icon.ico')],
)
