"""Entry point used by the packaged .exe (and convenient for running from source).

Starts the FastAPI app via uvicorn, passing the app object directly (no import-string
reload machinery) so it works inside a frozen PyInstaller bundle.
"""

import multiprocessing

import uvicorn

from main import app
from paths import DATA_DIR

HOST = "0.0.0.0"
PORT = 8000


def main() -> None:
    print(r"""
  ====================================================
     Live Sign Wall  —  server starting
  ====================================================
""")
    print(f"  Data folder : {DATA_DIR}")
    print(f"  Input page  : http://localhost:{PORT}/")
    print(f"  Display     : http://localhost:{PORT}/display")
    print(f"  Admin       : http://localhost:{PORT}/admin")
    print("\n  Tablets/display on the same Wi-Fi: use this PC's IP instead of localhost.")
    print("  Close this window (or press Ctrl+C) to stop the server.\n")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    multiprocessing.freeze_support()  # required for frozen Windows builds
    main()
