"""add employee department_ids

Revision ID: b7c9e1f2a3d4
Revises: fde2f8d63c62
Create Date: 2026-09-14 12:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7c9e1f2a3d4'
down_revision = 'fde2f8d63c62'
branch_labels = None
depends_on = None


def upgrade():
    try:
        op.add_column('employees', sa.Column('department_ids', sa.JSON(), nullable=True))
    except Exception:
        pass


def downgrade():
    try:
        op.drop_column('employees', 'department_ids')
    except Exception:
        pass
