"""add meeting_type to meetings

Revision ID: f1a8b3c5d7e9
Revises: a4dbfda45055
Create Date: 2026-09-10 11:28:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a8b3c5d7e9'
down_revision = 'a4dbfda45055'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meeting_type', sa.String(length=50), nullable=True, server_default='custom'))


def downgrade():
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.drop_column('meeting_type')
