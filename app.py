import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PyQt6 import QtCore, QtGui, QtWidgets

MOVIES_DIR = os.path.join(os.path.expanduser('~'), 'Documents', 'Movies')
DEFAULT_FOLDERS = [r'\\10.0.10.10\video\Film', MOVIES_DIR]
SUPPORTED_EXTENSIONS = ('.mkv', '.mp4')
APP_DIR = Path(__file__).resolve().parent


def save_folders(folders, current_folder=''):
    settings_path = APP_DIR / 'settings.txt'
    unique = []
    for folder in folders:
        if folder and os.path.isdir(folder) and folder not in unique:
            unique.append(folder)
    if current_folder and os.path.isdir(current_folder) and current_folder not in unique:
        unique.insert(0, current_folder)
    settings_path.write_text('\n'.join(unique), encoding='utf-8')


def load_saved_folders():
    settings_path = APP_DIR / 'settings.txt'
    if not settings_path.exists():
        return [folder for folder in DEFAULT_FOLDERS if os.path.isdir(folder)] or DEFAULT_FOLDERS
    folders = [line.strip() for line in settings_path.read_text(encoding='utf-8').splitlines() if line.strip()]
    valid = [folder for folder in folders if os.path.isdir(folder)]
    return valid or [folder for folder in DEFAULT_FOLDERS if os.path.isdir(folder)] or DEFAULT_FOLDERS


def clean_title(file_name: str) -> str:
    title = os.path.splitext(file_name)[0]
    title = title.replace('.', ' ').replace('_', ' ').replace('-', ' ')
    title = ' '.join(part for part in title.split() if part.lower() not in {'1080p', '720p', '2160p', 'x264', 'x265', 'bluray', 'brrip', 'webrip', 'hdrip', 'hdtv', 'yify', '2160', '1080', '720'})
    return ' '.join(word.capitalize() for word in title.split())


def load_folder() -> str:
    folders = load_saved_folders()
    return folders[0] if folders else MOVIES_DIR


def find_subtitles(file_path: str):
    folder = os.path.dirname(file_path)
    movie_base = os.path.splitext(os.path.basename(file_path))[0].lower()
    candidates = []
    for entry in os.listdir(folder):
        ext = os.path.splitext(entry)[1].lower()
        if ext in {'.srt', '.vtt', '.ass', '.ssa', '.sub', '.idx'}:
            subtitle_base = os.path.splitext(entry)[0].lower()
            if subtitle_base == movie_base or subtitle_base.startswith(movie_base + ' ') or movie_base.startswith(subtitle_base + ' '):
                candidates.append(os.path.join(folder, entry))
    return sorted(candidates) or sorted([
        os.path.join(folder, entry)
        for entry in os.listdir(folder)
        if os.path.splitext(entry)[1].lower() in {'.srt', '.vtt', '.ass', '.ssa', '.sub', '.idx'}
    ])


def find_movies(folder: str):
    movies = []
    if not os.path.isdir(folder):
        return movies
    for root, _, files in os.walk(folder):
        for file_name in files:
            if file_name.lower().endswith(SUPPORTED_EXTENSIONS):
                movies.append((clean_title(file_name), os.path.join(root, file_name)))
    return sorted(movies, key=lambda item: item[0].lower())


def normalize_path(path: str) -> str:
    normalized = os.path.normpath(path)
    if normalized.startswith('\\') or normalized.startswith('//'):
        normalized = normalized.replace('/', '\\')
    return normalized


def find_vlc_executable():
    candidates = [
        r'C:\Program Files\VideoLAN\VLC\vlc.exe',
        r'C:\Program Files (x86)\VideoLAN\VLC\vlc.exe',
        r'C:\Program Files\VLC\vlc.exe',
        r'C:\Program Files (x86)\VLC\vlc.exe',
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None


def fetch_movie_details(title: str):
    query = os.path.splitext(title)[0].replace('.', ' ').replace('_', ' ').replace('-', ' ').strip()
    url = f'https://www.omdbapi.com/?apikey=trilogy&t={urllib.parse.quote(query)}&plot=short&type=movie'
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            payload = json.loads(response.read().decode('utf-8'))
        if payload.get('Response') != 'True':
            return None, payload.get('Error', 'No online details found.')

        poster_url = payload.get('Poster', '')
        poster_bytes = None
        if poster_url and poster_url != 'N/A':
            try:
                with urllib.request.urlopen(poster_url, timeout=20) as image_response:
                    poster_bytes = image_response.read()
            except urllib.error.URLError:
                poster_bytes = None

        return {
            'title': payload.get('Title', title),
            'year': payload.get('Year', ''),
            'genre': payload.get('Genre', ''),
            'runtime': payload.get('Runtime', ''),
            'plot': payload.get('Plot', 'No plot summary is available yet.'),
            'poster_bytes': poster_bytes,
            'imdb_id': payload.get('imdbID', ''),
        }, None
    except Exception as exc:
        return None, str(exc)


class MovieDetailsWorker(QtCore.QObject):
    finished = QtCore.pyqtSignal(object, str)

    @QtCore.pyqtSlot(str)
    def fetch(self, title: str):
        details, error = fetch_movie_details(title)
        self.finished.emit(details, error or '')


def play_movie(file_path: str, subtitle_path: str = ''):
    vlc_path = find_vlc_executable()
    try:
        fixed_path = normalize_path(file_path)
        if vlc_path:
            command = [vlc_path, fixed_path]
            if subtitle_path:
                command += ['--sub-file', normalize_path(subtitle_path)]
            subprocess.Popen(command, shell=False)
            return 'VLC'
        if os.name == 'nt' and hasattr(os, 'startfile'):
            os.startfile(fixed_path)
            return 'default player'
        raise RuntimeError('No compatible player found.')
    except Exception as exc:
        QtWidgets.QMessageBox.critical(None, 'Playback error', f'Unable to open the movie.\n{exc}')
        return None


class MovieBrowser(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Movie Browser')
        self.resize(1220, 780)
        self.setMinimumSize(1080, 680)
        self.movies = []
        self.selected_path = ''
        self.selected_title = ''
        self.selected_subtitle = ''
        self.details_thread = None
        self.details_worker = None

        if (APP_DIR / 'movie_icon.png').exists():
            try:
                self.setWindowIcon(QtGui.QIcon(str(APP_DIR / 'movie_icon.png')))
            except Exception:
                pass

        self._apply_theme()
        self._build_ui()
        self._setup_details_thread()
        self.refresh_movies()

    def _setup_details_thread(self):
        self.details_worker = MovieDetailsWorker()
        self.details_thread = QtCore.QThread(self)
        self.details_worker.moveToThread(self.details_thread)
        self.details_worker.finished.connect(self.on_details_ready)
        self.details_thread.start()

    def _apply_theme(self):
        self.setStyleSheet('''
            QWidget { font-family: "Segoe UI", Arial, sans-serif; background: #07111f; color: #edf4ff; }
            QMainWindow, QDialog { background: #07111f; }
            QFrame, QListWidget, QTreeWidget, QLineEdit, QComboBox, QPushButton { background: #0b1220; color: #edf4ff; border: 1px solid #1b2841; border-radius: 10px; }
            QLabel { color: #edf4ff; }
            QToolButton, QPushButton { padding: 8px 10px; border-radius: 10px; background: #18253b; }
            QPushButton:hover { background: #223752; }
            QPushButton#playBtn { background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #5d7cff, stop:1 #7a5cff); color: white; }
            QPushButton#playBtn:hover { background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #7c97ff, stop:1 #8a7cff); }
            QListWidget::item:selected, QTreeWidget::item:selected { background: #314a75; color: #ffffff; }
            QTreeWidget::item:hover { background: #132132; }
            QStatusBar { background: transparent; color: #b7c5e5; }
        ''')

    def _build_ui(self):
        central = QtWidgets.QWidget(self)
        self.setCentralWidget(central)
        main_layout = QtWidgets.QHBoxLayout(central)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(16)

        left = QtWidgets.QFrame()
        left.setObjectName('sidebar')
        left.setMinimumWidth(340)
        left.setMaximumWidth(380)
        left_layout = QtWidgets.QVBoxLayout(left)
        left_layout.setSpacing(12)

        hero = QtWidgets.QFrame()
        hero_layout = QtWidgets.QVBoxLayout(hero)
        hero_layout.setContentsMargins(14, 14, 14, 14)
        title = QtWidgets.QLabel('Movie Library')
        title.setStyleSheet('font-size: 18px; font-weight: 700; color: white;')
        subtitle = QtWidgets.QLabel('Clean local playback with saved folders and subtitles.')
        subtitle.setWordWrap(True)
        subtitle.setStyleSheet('color: #b7c5e5;')
        hero_layout.addWidget(title)
        hero_layout.addWidget(subtitle)

        info_card = QtWidgets.QFrame()
        info_layout = QtWidgets.QVBoxLayout(info_card)
        info_layout.setContentsMargins(14, 12, 14, 12)
        info_title = QtWidgets.QLabel('Current folder')
        info_title.setStyleSheet('color: #8aa5ff; font-weight: 700; font-size: 10px;')
        self.folder_label = QtWidgets.QLabel('')
        self.folder_label.setWordWrap(True)
        info_layout.addWidget(info_title)
        info_layout.addWidget(self.folder_label)

        stats_card = QtWidgets.QFrame()
        stats_layout = QtWidgets.QVBoxLayout(stats_card)
        stats_layout.setContentsMargins(14, 12, 14, 12)
        self.stats_label = QtWidgets.QLabel('0 titles ready')
        self.stats_label.setStyleSheet('font-size: 13px; font-weight: 700; color: white;')
        self.stats_hint = QtWidgets.QLabel('VLC is preferred for smooth playback.')
        self.stats_hint.setWordWrap(True)
        self.stats_hint.setStyleSheet('color: #b7c5e5;')
        stats_layout.addWidget(self.stats_label)
        stats_layout.addWidget(self.stats_hint)

        self.add_folder_btn = QtWidgets.QPushButton('Add folder')
        self.refresh_btn = QtWidgets.QPushButton('Refresh list')
        self.play_btn = QtWidgets.QPushButton('Play selected movie')
        self.play_btn.setObjectName('playBtn')

        self.detail_title = QtWidgets.QLabel('Click any title to load online details.')
        self.detail_title.setWordWrap(True)
        self.detail_title.setStyleSheet('font-weight: 700; color: white;')
        self.detail_meta = QtWidgets.QLabel('')
        self.detail_meta.setWordWrap(True)
        self.detail_meta.setStyleSheet('color: #8aa5ff; font-size: 11px;')
        self.detail_plot = QtWidgets.QLabel('')
        self.detail_plot.setWordWrap(True)
        self.detail_plot.setStyleSheet('color: #edf4ff; font-size: 12px; line-height: 1.35;')
        self.detail_poster = QtWidgets.QLabel('No cover loaded yet.')
        self.detail_poster.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.detail_poster.setMinimumHeight(140)
        self.detail_poster.setStyleSheet('border: 1px dashed #24364f; border-radius: 12px; color: #b7c5e5; padding: 10px;')

        self.add_folder_btn.clicked.connect(self.choose_folder)
        self.refresh_btn.clicked.connect(self.refresh_movies)
        self.play_btn.clicked.connect(self.play_selected)

        libs_label = QtWidgets.QLabel('Saved libraries')
        libs_label.setStyleSheet('color: #8aa5ff; font-weight: 700; font-size: 10px;')
        self.library_list = QtWidgets.QListWidget()
        self.library_list.setMinimumHeight(180)
        self.library_list.itemClicked.connect(self.use_saved_folder)

        left_layout.addWidget(hero)
        left_layout.addWidget(info_card)
        left_layout.addWidget(stats_card)
        left_layout.addWidget(self.add_folder_btn)
        left_layout.addWidget(self.refresh_btn)
        left_layout.addWidget(self.play_btn)

        detail_header = QtWidgets.QLabel('Selected movie details')
        detail_header.setStyleSheet('color: #8aa5ff; font-weight: 700; font-size: 10px;')
        left_layout.addWidget(detail_header)
        left_layout.addWidget(self.detail_poster)
        left_layout.addWidget(self.detail_title)
        left_layout.addWidget(self.detail_meta)
        left_layout.addWidget(self.detail_plot)

        left_layout.addWidget(libs_label)
        left_layout.addWidget(self.library_list)

        right = QtWidgets.QFrame()
        right_layout = QtWidgets.QVBoxLayout(right)
        right_layout.setSpacing(10)

        search_row = QtWidgets.QFrame()
        search_row_layout = QtWidgets.QHBoxLayout(search_row)
        search_row_layout.setContentsMargins(10, 8, 10, 8)
        search_label = QtWidgets.QLabel('Search titles')
        self.search_input = QtWidgets.QLineEdit()
        self.search_input.setPlaceholderText('Filter the current list...')
        self.search_input.textChanged.connect(self.filter_list)
        search_row_layout.addWidget(search_label)
        search_row_layout.addWidget(self.search_input, 1)

        self.status_label = QtWidgets.QLabel('Loading movies…')
        self.status_label.setStyleSheet('color: #b7c5e5;')

        subtitle_row = QtWidgets.QFrame()
        subtitle_row_layout = QtWidgets.QHBoxLayout(subtitle_row)
        subtitle_row_layout.setContentsMargins(10, 8, 10, 8)
        sub_label = QtWidgets.QLabel('Subtitle')
        self.subtitle_combo = QtWidgets.QComboBox()
        self.subtitle_combo.addItem('Auto')
        self.subtitle_combo.currentIndexChanged.connect(self.update_selected_subtitle)
        subtitle_row_layout.addWidget(sub_label)
        subtitle_row_layout.addWidget(self.subtitle_combo, 1)

        self.movie_tree = QtWidgets.QTreeWidget()
        self.movie_tree.setColumnCount(2)
        self.movie_tree.setHeaderLabels(['Title', 'Path'])
        self.movie_tree.setColumnHidden(1, True)
        self.movie_tree.setRootIsDecorated(False)
        self.movie_tree.itemSelectionChanged.connect(self.on_select)

        right_layout.addWidget(search_row)
        right_layout.addWidget(self.status_label)
        right_layout.addWidget(subtitle_row)
        right_layout.addWidget(self.movie_tree, 1)

        main_layout.addWidget(left)
        main_layout.addWidget(right, 1)

        self.statusBar().setStyleSheet('color: #b7c5e5;')

    def choose_folder(self):
        initial = self.folder_label.text() or load_folder()
        folder = QtWidgets.QFileDialog.getExistingDirectory(self, 'Choose a movie folder', initial)
        if folder:
            save_folders([folder, *load_saved_folders()], current_folder=folder)
            self.refresh_saved_list()
            self.refresh_movies()

    def refresh_saved_list(self):
        self.library_list.clear()
        for folder in load_saved_folders():
            self.library_list.addItem(folder)

    def use_saved_folder(self, item):
        folder = item.text()
        save_folders([folder, *[path for path in load_saved_folders() if path != folder]], current_folder=folder)
        self.refresh_saved_list()
        self.refresh_movies()

    def refresh_movies(self):
        current_folder = load_folder()
        self.folder_label.setText(current_folder)
        self.refresh_saved_list()
        self.movies = find_movies(current_folder)
        self.populate_list(self.movies)
        if self.movies:
            self.status_label.setText(f'Found {len(self.movies)} movie file(s) in {current_folder}.')
            self.stats_label.setText(f'{len(self.movies)} title(s) ready for playback')
            save_folders(load_saved_folders(), current_folder=current_folder)
        else:
            self.status_label.setText('No .mkv/.mp4 files found in the selected folder.')
            self.stats_label.setText('0 titles ready')

    def populate_list(self, items):
        self.movie_tree.clear()
        query = self.search_input.text().strip().lower()
        filtered = [item for item in items if query in item[0].lower()]
        for title, path in filtered:
            item = QtWidgets.QTreeWidgetItem([title, path])
            self.movie_tree.addTopLevelItem(item)

    def filter_list(self, _event=None):
        self.populate_list(self.movies)

    def update_selected_subtitle(self, _event=None):
        self.selected_subtitle = ''
        choice = self.subtitle_combo.currentText()
        if choice and choice != 'Auto':
            self.selected_subtitle = choice

    def on_select(self):
        selected = self.movie_tree.selectedItems()
        if not selected:
            self.selected_path = ''
            self.selected_title = ''
            self.selected_subtitle = ''
            self.subtitle_combo.clear()
            self.subtitle_combo.addItem('Auto')
            self.detail_title.setText('Click any title to load online details.')
            self.detail_meta.setText('')
            self.detail_plot.setText('')
            self.detail_poster.setText('No cover loaded yet.')
            return

        item = selected[0]
        self.selected_title = item.text(0)
        self.selected_path = item.text(1)

        self.detail_title.setText('Loading online details…')
        self.detail_meta.setText('')
        self.detail_plot.setText('')
        self.detail_poster.setText('Fetching cover art…')

        subtitles = find_subtitles(self.selected_path) if self.selected_path else []
        self.subtitle_combo.clear()
        self.subtitle_combo.addItem('Auto')
        for subtitle in subtitles:
            self.subtitle_combo.addItem(os.path.basename(subtitle))
        self.subtitle_combo.setCurrentIndex(0)
        self.selected_subtitle = ''

        if self.details_worker is not None:
            QtCore.QMetaObject.invokeMethod(self.details_worker, 'fetch', QtCore.Qt.ConnectionType.QueuedConnection, QtCore.Q_ARG(str, self.selected_title))

    def on_details_ready(self, details, error):
        if not details:
            self.detail_title.setText(f'Online details unavailable for {self.selected_title}.')
            self.detail_meta.setText('This fetch is temporary and only lives in memory for this session.')
            self.detail_plot.setText(error)
            self.detail_poster.setText('No cover image returned.')
            return

        self.detail_title.setText(details['title'])
        self.detail_meta.setText(' • '.join(part for part in [details['year'], details['genre'], details['runtime']] if part))
        self.detail_plot.setText(details['plot'])

        cover = details.get('poster_bytes')
        if cover:
            pixmap = QtGui.QPixmap()
            pixmap.loadFromData(cover)
            if not pixmap.isNull():
                scaled = pixmap.scaled(240, 340, QtCore.Qt.AspectRatioMode.KeepAspectRatio, QtCore.Qt.TransformationMode.SmoothTransformation)
                self.detail_poster.setPixmap(scaled)
                self.detail_poster.setText('')
                return

        self.detail_poster.setPixmap(QtGui.QPixmap())
        self.detail_poster.setText('No cover image returned.')

    def play_selected(self):
        if not self.selected_path:
            QtWidgets.QMessageBox.information(self, 'Select a movie', 'Choose a movie from the list first.')
            return
        subtitles = find_subtitles(self.selected_path)
        subtitle_path = ''
        if not self.selected_subtitle or self.selected_subtitle == 'Auto':
            subtitle_path = subtitles[0] if subtitles else ''
        else:
            subtitle_path = next((path for path in subtitles if os.path.basename(path) == self.selected_subtitle), '')
        player = play_movie(self.selected_path, subtitle_path)
        if player:
            self.status_label.setText(f'Playing {self.selected_title or os.path.basename(self.selected_path)} in {player}.')

    def closeEvent(self, event):
        save_folders(load_saved_folders(), current_folder=self.folder_label.text() or load_folder())
        event.accept()


def main():
    app = QtWidgets.QApplication(sys.argv)
    window = MovieBrowser()
    window.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
