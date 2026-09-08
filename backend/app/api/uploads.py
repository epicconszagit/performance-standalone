import uuid

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

uploads_bp = Blueprint("uploads", __name__)

# Documents, spreadsheets, images, video, audio, archives - basically anything
# a task/report/announcement attachment might reasonably be. Only genuinely
# dangerous types are blocked: executables (could harm whoever downloads and
# runs them) and anything a browser would execute as active content
# (.html/.svg/.js etc). The main defense against the latter is that
# /uploads/<file> always serves with Content-Disposition: attachment, forcing
# a download instead of inline rendering - this blocklist is defense in depth
# on top of that, not the primary protection.
BLOCKED_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "scr", "msi", "msix", "ps1", "vbs", "vbe",
    "js", "mjs", "jar", "app", "apk", "dll", "sh", "bash", "php", "phtml",
    "html", "htm", "svg", "xhtml", "wasm", "jsp", "asp", "aspx", "cgi", "reg",
}


def _extension_blocked(filename):
    if "." not in filename:
        return False
    return filename.rsplit(".", 1)[-1].lower() in BLOCKED_EXTENSIONS


@uploads_bp.route("/uploads", methods=["POST"])
@jwt_required()
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "no file provided"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "empty filename"}), 400
    if _extension_blocked(file.filename):
        return jsonify({"error": "That file type isn't supported for security reasons."}), 400

    filename = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4().hex}-{filename}"
    file.save(f"{current_app.config['UPLOAD_FOLDER']}/{unique_name}")

    return jsonify({"file_url": f"/uploads/{unique_name}", "file_name": filename}), 201
