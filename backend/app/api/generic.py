from datetime import date, datetime

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import User


def _coerce_value(column, value):
    """The frontend sends plain JSON (empty strings for unset dates, ISO
    strings for set ones). SQLAlchemy's Date/DateTime columns need real
    date/datetime objects or None - never a string, empty or otherwise.
    """
    col_type = column.type.__class__.__name__
    if col_type in ("Date", "DateTime"):
        if value in (None, ""):
            return None
        if isinstance(value, str):
            iso_value = value[:-1] + "+00:00" if value.endswith("Z") else value
            parsed = datetime.fromisoformat(iso_value)
            return parsed.date() if col_type == "Date" else parsed
    return value


def _apply_fields(model, obj, data):
    columns = {c.name: c for c in model.__table__.columns}
    for key, value in data.items():
        if key in columns and key != "id":
            setattr(obj, key, _coerce_value(columns[key], value))


def _missing_required_fields(model, obj):
    """Columns that are NOT NULL, have no default, and are still empty -
    catches a bad create request before it hits the database as a 500."""
    missing = []
    for column in model.__table__.columns:
        if column.primary_key or column.nullable:
            continue
        if column.default is not None or column.server_default is not None:
            continue
        if getattr(obj, column.name, None) in (None, ""):
            missing.append(column.name)
    return missing


def current_user():
    uid = get_jwt_identity()
    if not uid:
        return None
    return User.query.get(uid)


def _is_admin(user):
    return user is not None and user.role == "admin"


def check_permission(rule, user, obj, owner_field):
    """rule is one of: 'any', 'admin', 'owner_or_admin'.

    For 'owner_or_admin' with no obj yet (create), any authenticated user
    is allowed - ownership only applies to update/delete on an existing row.
    """
    if rule == "any":
        return user is not None
    if rule == "admin":
        return _is_admin(user)
    if rule == "owner_or_admin":
        if user is None:
            return False
        if _is_admin(user):
            return True
        if obj is None:
            return True
        return getattr(obj, owner_field, None) == user.id
    return False


def register_entity(bp, model, name, create="any", update="any", delete="any", owner_field="created_by_id"):
    """Registers GET (list/filter), POST, PATCH, DELETE routes for one entity
    under /<name>, mirroring the base44 SDK's list/filter/create/update/delete shape.
    """

    def list_entity():
        query = model.query
        for key, value in request.args.items():
            if key in ("sort", "limit"):
                continue
            if hasattr(model, key):
                query = query.filter(getattr(model, key) == value)

        sort = request.args.get("sort")
        if sort:
            desc = sort.startswith("-")
            field = sort[1:] if desc else sort
            if hasattr(model, field):
                column = getattr(model, field)
                query = query.order_by(column.desc() if desc else column.asc())

        limit = request.args.get("limit", type=int)
        if limit:
            query = query.limit(limit)

        return jsonify([obj.to_dict() for obj in query.all()])

    def create_entity():
        user = current_user()
        if not check_permission(create, user, None, owner_field):
            return jsonify({"error": "forbidden"}), 403
        data = request.get_json(silent=True) or {}
        obj = model()
        _apply_fields(model, obj, data)
        if hasattr(model, owner_field) and not getattr(obj, owner_field, None) and user is not None:
            setattr(obj, owner_field, user.id)
        missing = _missing_required_fields(model, obj)
        if missing:
            return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400
        db.session.add(obj)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({"error": "Could not save - a database constraint was violated."}), 400
        return jsonify(obj.to_dict()), 201

    def update_entity(entity_id):
        obj = model.query.get_or_404(entity_id)
        user = current_user()
        if not check_permission(update, user, obj, owner_field):
            return jsonify({"error": "forbidden"}), 403
        data = request.get_json(silent=True) or {}
        _apply_fields(model, obj, data)
        missing = _missing_required_fields(model, obj)
        if missing:
            return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({"error": "Could not save - a database constraint was violated."}), 400
        return jsonify(obj.to_dict())

    def delete_entity(entity_id):
        obj = model.query.get_or_404(entity_id)
        user = current_user()
        if not check_permission(delete, user, obj, owner_field):
            return jsonify({"error": "forbidden"}), 403
        db.session.delete(obj)
        db.session.commit()
        return "", 204

    bp.add_url_rule(f"/{name}", endpoint=f"list_{name}", view_func=jwt_required()(list_entity), methods=["GET"])
    bp.add_url_rule(f"/{name}", endpoint=f"create_{name}", view_func=jwt_required()(create_entity), methods=["POST"])
    bp.add_url_rule(
        f"/{name}/<entity_id>", endpoint=f"update_{name}", view_func=jwt_required()(update_entity), methods=["PATCH"]
    )
    bp.add_url_rule(
        f"/{name}/<entity_id>", endpoint=f"delete_{name}", view_func=jwt_required()(delete_entity), methods=["DELETE"]
    )
