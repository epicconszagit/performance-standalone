from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..utils.email import send_email

email_bp = Blueprint("email", __name__)


@email_bp.route("/send-email", methods=["POST"])
@jwt_required()
def send_email_route():
    data = request.get_json(silent=True) or {}
    send_email(to=data.get("to"), subject=data.get("subject"), body=data.get("body"))
    return jsonify({"ok": True})
